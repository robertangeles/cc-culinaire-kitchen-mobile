package com.anonymous.ccculinairekitchenmob.download

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.RandomAccessFile
import java.net.URI
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

/**
 * CoroutineWorker that does the actual byte streaming for one download.
 *
 * Lifecycle:
 *  1. Read DownloadEntity by downloadId from Room.
 *  2. SSRF guard: confirm the URL host is in ALLOWED_HOSTS.
 *  3. Disk space pre-flight (need totalBytes + headroom).
 *  4. If destination file exists, send Range header from `existing`
 *     bytes; expect HTTP 206. Else send no range; expect HTTP 200.
 *  5. Stream response body in 64 KB chunks, append to file via
 *     RandomAccessFile.seek(existing) + write().
 *  6. Throttled progress emission (every 256 KB OR every 500 ms).
 *  7. On EOF, optional SHA-256 verify; on mismatch, delete + retry.
 *
 * Failure handling:
 *  - Network exceptions -> classifyException() -> Result.retry()
 *    so WorkManager re-runs with backoff once Network constraint is met.
 *  - 4xx HTTP -> Result.failure() (won't retry; user error or stale URL).
 *  - 5xx HTTP -> Result.retry() (server transient).
 *  - SHA mismatch -> delete + Result.failure() (don't loop forever on
 *    a bad upload).
 */
class DownloadWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val downloadId = inputData.getString(KEY_DOWNLOAD_ID)
            ?: return@withContext Result.failure()

        val dao = DownloadDatabase.getInstance(applicationContext).downloadDao()
        val entity = dao.getByDownloadId(downloadId)
            ?: return@withContext Result.failure()

        // SSRF: only allow the R2 host configured at compile time.
        val host = runCatching { URI(entity.url).host }.getOrNull()
        if (host == null || host !in ALLOWED_HOSTS) {
            dao.updateStatus(downloadId, DownloadStatus.FAILED, DownloadReason.CLIENT_ERROR.code)
            DownloadEventBridge.emitError(
                downloadId, entity.modelId, entity.fileName,
                DownloadReason.CLIENT_ERROR,
                "Refused: host not in allowlist ($host)",
            )
            return@withContext Result.failure()
        }

        try {
            setForeground(buildForegroundInfo(entity.fileName, 0, entity.totalBytes))
        } catch (_: Throwable) {
            // Foreground promotion can fail on Android 12+ if the app
            // is in a restricted background state. We continue anyway —
            // WorkManager will keep us alive long enough for short work,
            // and the system kills us cleanly for long work (the user
            // sees download paused, then resumes on next foreground).
        }

        dao.updateStatus(downloadId, DownloadStatus.RUNNING, DownloadReason.NONE.code)

        val destFile = File(entity.destinationPath)
        destFile.parentFile?.mkdirs()
        val existing = if (destFile.exists()) destFile.length() else 0L

        // Disk space pre-flight: need (totalBytes - existing) + 64MB headroom.
        val needed = max(0, entity.totalBytes - existing) + 64L * 1024 * 1024
        val free = runCatching { destFile.parentFile?.usableSpace ?: 0L }.getOrDefault(0L)
        if (entity.totalBytes > 0 && free < needed) {
            dao.updateStatus(downloadId, DownloadStatus.FAILED, DownloadReason.DISK_FULL.code)
            DownloadEventBridge.emitError(
                downloadId, entity.modelId, entity.fileName,
                DownloadReason.DISK_FULL,
                "Need ${needed / 1024 / 1024} MB, have ${free / 1024 / 1024} MB",
            )
            return@withContext Result.failure()
        }

        val client = httpClient()
        val request = Request.Builder()
            .url(entity.url)
            .apply { if (existing > 0) header("Range", "bytes=$existing-") }
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val code = response.code
                val body = response.body
                    ?: return@withContext failWith(
                        dao, entity, DownloadReason.EMPTY_RESPONSE,
                        "Empty response body",
                    )

                if (existing > 0 && code != 206) {
                    // Server doesn't support range; restart from zero.
                    if (destFile.exists()) destFile.delete()
                    return@withContext Result.retry()
                }
                if (existing == 0L && code != 200) {
                    val reason = classifyHttpStatus(code)
                    return@withContext if (code in 500..599) {
                        dao.updateStatus(downloadId, DownloadStatus.FAILED, reason.code)
                        DownloadEventBridge.emitError(
                            downloadId, entity.modelId, entity.fileName,
                            reason, "HTTP $code",
                        )
                        Result.retry()
                    } else {
                        failWith(dao, entity, reason, "HTTP $code")
                    }
                }

                // If server gave us a real Content-Length and our stored
                // totalBytes was 0 (unknown at start), record it now.
                val contentLen = body.contentLength()
                val totalBytes = when {
                    entity.totalBytes > 0 -> entity.totalBytes
                    contentLen > 0 -> existing + contentLen
                    else -> 0L
                }
                if (totalBytes != entity.totalBytes && totalBytes > 0) {
                    dao.updateTotalBytes(downloadId, totalBytes)
                }

                streamToFile(
                    dao = dao,
                    entity = entity.copy(totalBytes = totalBytes),
                    body = body.byteStream(),
                    destFile = destFile,
                    startBytes = existing,
                )
            }
        } catch (t: Throwable) {
            val reason = classifyException(t)
            dao.updateStatus(downloadId, DownloadStatus.FAILED, reason.code)
            DownloadEventBridge.emitError(
                downloadId, entity.modelId, entity.fileName, reason, t.message,
            )
            return@withContext Result.retry()
        }

        // Optional SHA-256 verify.
        val expected = entity.expectedSha256
        if (!expected.isNullOrBlank()) {
            val actual = sha256(destFile)
            if (!actual.equals(expected, ignoreCase = true)) {
                destFile.delete()
                return@withContext failWith(
                    dao, entity, DownloadReason.FILE_CORRUPTED,
                    "SHA-256 mismatch (expected $expected, got $actual)",
                )
            }
        }

        dao.updateStatus(downloadId, DownloadStatus.COMPLETED, DownloadReason.NONE.code)
        DownloadEventBridge.emitComplete(
            downloadId = downloadId,
            modelId = entity.modelId,
            fileName = entity.fileName,
            destinationPath = entity.destinationPath,
            totalBytes = destFile.length(),
        )
        Result.success()
    }

    private suspend fun streamToFile(
        dao: DownloadDao,
        entity: DownloadEntity,
        body: java.io.InputStream,
        destFile: File,
        startBytes: Long,
    ) {
        val downloadId = entity.downloadId
        val totalBytes = entity.totalBytes
        var soFar = startBytes
        var lastEmitBytes = startBytes
        var lastEmitTime = System.currentTimeMillis()

        RandomAccessFile(destFile, "rw").use { raf ->
            raf.seek(startBytes)
            val buf = ByteArray(64 * 1024)
            while (true) {
                if (isStopped) {
                    dao.updateProgress(
                        downloadId, soFar, DownloadStatus.PAUSED,
                        DownloadReason.USER_CANCELLED.code,
                    )
                    return
                }
                val read = body.read(buf)
                if (read <= 0) break
                raf.write(buf, 0, read)
                soFar += read

                val now = System.currentTimeMillis()
                val deltaBytes = soFar - lastEmitBytes
                val deltaTime = now - lastEmitTime
                if (deltaBytes >= EMIT_BYTES || deltaTime >= EMIT_INTERVAL_MS) {
                    dao.updateProgress(
                        downloadId, soFar, DownloadStatus.RUNNING,
                        DownloadReason.NONE.code,
                    )
                    DownloadEventBridge.emitProgress(
                        downloadId = downloadId,
                        modelId = entity.modelId,
                        fileName = entity.fileName,
                        bytesDownloaded = soFar,
                        totalBytes = totalBytes,
                        status = DownloadStatus.RUNNING,
                    )
                    runCatching {
                        setForeground(
                            buildForegroundInfo(entity.fileName, soFar, totalBytes),
                        )
                    }
                    lastEmitBytes = soFar
                    lastEmitTime = now
                }
            }
        }

        // Final progress tick so the bar lands exactly on totalBytes.
        dao.updateProgress(
            downloadId, soFar, DownloadStatus.RUNNING, DownloadReason.NONE.code,
        )
        DownloadEventBridge.emitProgress(
            downloadId = downloadId,
            modelId = entity.modelId,
            fileName = entity.fileName,
            bytesDownloaded = soFar,
            totalBytes = totalBytes,
            status = DownloadStatus.RUNNING,
        )
    }

    private suspend fun failWith(
        dao: DownloadDao,
        entity: DownloadEntity,
        reason: DownloadReason,
        message: String,
    ): Result {
        dao.updateStatus(entity.downloadId, DownloadStatus.FAILED, reason.code)
        DownloadEventBridge.emitError(
            entity.downloadId, entity.modelId, entity.fileName, reason, message,
        )
        return Result.failure()
    }

    private fun buildForegroundInfo(
        fileName: String,
        bytes: Long,
        total: Long,
    ): ForegroundInfo {
        val mgr = applicationContext
            .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Model downloads",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Downloading the Antoine model in the background"
                setShowBadge(false)
            }
            mgr.createNotificationChannel(channel)
        }

        val pct = if (total > 0) min(100, ((bytes * 100) / total).toInt()) else 0
        val notification: Notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("Downloading $fileName")
            .setContentText("$pct%  •  ${bytes / 1024 / 1024} MB / ${total / 1024 / 1024} MB")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(100, pct, total <= 0)
            .build()

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buf)
                if (read <= 0) break
                digest.update(buf, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun httpClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    companion object {
        const val KEY_DOWNLOAD_ID = "download_id"

        private const val CHANNEL_ID = "ckm_model_download"
        private const val NOTIFICATION_ID = 0xC1F /* "CIF" */

        private const val EMIT_BYTES = 256L * 1024
        private const val EMIT_INTERVAL_MS = 500L

        // SSRF: any URL outside this set is rejected by the worker.
        // Update when a new CDN host is added — config plugin docs
        // call this out as the place to edit.
        val ALLOWED_HOSTS: Set<String> = setOf(
            "pub-7a835c8f4b344301811de8e23b8b3983.r2.dev",
        )
    }
}
