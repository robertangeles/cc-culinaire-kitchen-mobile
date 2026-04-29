package com.anonymous.ccculinairekitchenmob.download

import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * React Native bridge for the background download module.
 *
 * Exposed JS API (NativeModules.BackgroundDownloadModule):
 *  - startDownload({ url, fileName, modelId, totalBytes?, sha256?,
 *                    subdirectory? }) -> downloadId
 *  - cancelDownload(downloadId) -> bool
 *  - getActiveDownloads() -> array of DownloadProgressEvent
 *  - getDocumentDirectory() -> absolute path of the app's files dir
 *  - addListener / removeListeners — required by NativeEventEmitter,
 *    no-ops here because emission goes through DeviceEventManagerModule.
 */
class BackgroundDownloadModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val dao by lazy { DownloadDatabase.getInstance(reactContext).downloadDao() }

    init {
        DownloadEventBridge.attach(reactContext)
    }

    override fun getName(): String = NAME

    override fun invalidate() {
        DownloadEventBridge.detach()
        super.invalidate()
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN built-in event emitter; intentionally empty.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN built-in event emitter; intentionally empty.
    }

    @ReactMethod
    fun startDownload(params: ReadableMap, promise: Promise) {
        val url = params.getStringOrNull("url")
        val fileName = params.getStringOrNull("fileName")
        val modelId = params.getStringOrNull("modelId")
        // JS passes a relative subdirectory (e.g. "models/antoine/v1");
        // we resolve against the app's private files dir so JS doesn't
        // need to know the Android filesystem layout. This is the same
        // location `expo-file-system`'s documentDirectory points to.
        val subdirectory = params.getStringOrNull("subdirectory") ?: ""
        if (url == null || fileName == null || modelId == null) {
            promise.reject("INVALID_ARGS", "url, fileName, modelId are required")
            return
        }
        val totalBytes = if (params.hasKey("totalBytes") && !params.isNull("totalBytes")) {
            params.getDouble("totalBytes").toLong()
        } else 0L
        val sha256 = params.getStringOrNull("sha256")

        // SSRF guard at the bridge too — fail fast before enqueueing.
        val host = runCatching { java.net.URI(url).host }.getOrNull()
        if (host == null || host !in DownloadWorker.ALLOWED_HOSTS) {
            promise.reject("HOST_NOT_ALLOWED", "Refused: host not in allowlist ($host)")
            return
        }

        val downloadId = UUID.randomUUID().toString()
        val baseDir = reactContext.filesDir
        val targetDir = if (subdirectory.isBlank()) baseDir else File(baseDir, subdirectory)
        val destinationPath = File(targetDir, fileName).absolutePath

        scope.launch {
            // De-dupe: if there's already an active download for the same
            // destinationPath, return its downloadId instead of starting
            // a second worker that would race writes against the file.
            val existing = dao.getActiveDownloads()
                .firstOrNull { it.destinationPath == destinationPath }
            if (existing != null) {
                promise.resolve(existing.downloadId)
                return@launch
            }

            dao.upsert(
                DownloadEntity(
                    downloadId = downloadId,
                    modelId = modelId,
                    fileName = fileName,
                    url = url,
                    destinationPath = destinationPath,
                    expectedSha256 = sha256,
                    totalBytes = totalBytes,
                ),
            )

            val request = OneTimeWorkRequestBuilder<DownloadWorker>()
                .setInputData(Data.Builder().putString(DownloadWorker.KEY_DOWNLOAD_ID, downloadId).build())
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .addTag(WORK_TAG)
                .addTag("downloadId:$downloadId")
                .build()

            WorkManager.getInstance(reactContext).enqueueUniqueWork(
                "download:$downloadId",
                ExistingWorkPolicy.KEEP,
                request,
            )
            dao.setWorkId(downloadId, request.id.toString())
            promise.resolve(downloadId)
        }
    }

    @ReactMethod
    fun cancelDownload(downloadId: String, promise: Promise) {
        scope.launch {
            try {
                WorkManager.getInstance(reactContext).cancelAllWorkByTag("downloadId:$downloadId")
                dao.updateStatus(downloadId, DownloadStatus.CANCELLED, DownloadReason.USER_CANCELLED.code)
                val entity = dao.getByDownloadId(downloadId)
                if (entity != null) {
                    val partial = File(entity.destinationPath)
                    if (partial.exists()) partial.delete()
                }
                promise.resolve(true)
            } catch (t: Throwable) {
                promise.reject("CANCEL_FAILED", t.message, t)
            }
        }
    }

    @ReactMethod
    fun getDocumentDirectory(promise: Promise) {
        promise.resolve(reactContext.filesDir.absolutePath)
    }

    @ReactMethod
    fun getActiveDownloads(promise: Promise) {
        scope.launch {
            try {
                val rows = dao.getActiveDownloads()
                val arr: WritableArray = Arguments.createArray()
                rows.forEach { e ->
                    val map = Arguments.createMap().apply {
                        putString("downloadId", e.downloadId)
                        putString("modelId", e.modelId)
                        putString("fileName", e.fileName)
                        putString("url", e.url)
                        putString("destinationPath", e.destinationPath)
                        putDouble("bytesDownloaded", e.bytesDownloaded.toDouble())
                        putDouble("totalBytes", e.totalBytes.toDouble())
                        putString("status", e.status.name)
                        putString("reasonCode", e.reasonCode)
                    }
                    arr.pushMap(map)
                }
                promise.resolve(arr)
            } catch (t: Throwable) {
                promise.reject("LIST_FAILED", t.message, t)
            }
        }
    }

    private fun ReadableMap.getStringOrNull(key: String): String? =
        if (hasKey(key) && !isNull(key)) getString(key) else null

    companion object {
        const val NAME = "BackgroundDownloadModule"
        const val WORK_TAG = "ckm_model_download"
    }
}
