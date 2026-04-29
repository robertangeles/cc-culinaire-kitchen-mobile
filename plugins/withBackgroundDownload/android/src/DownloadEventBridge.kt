package com.anonymous.ccculinairekitchenmob.download

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.atomic.AtomicReference

/**
 * Singleton sink for download events emitted from the WorkManager
 * coroutine to the JS layer.
 *
 * The Worker runs on its own coroutine context, possibly while the
 * RN bridge is torn down (app backgrounded). We hold a soft reference
 * to ReactApplicationContext that the Module sets when JS is alive,
 * and silently drop events when the bridge is gone — JS catches up
 * by reading Room state via getActiveDownloads() on next foreground.
 *
 * Event name strings ("DownloadProgress", "DownloadComplete",
 * "DownloadError") are the contract with JS. Changing them breaks
 * the JS-side `NativeEventEmitter.addListener()` calls in
 * modelDownloadService.ts.
 */
object DownloadEventBridge {
    private val reactContextRef = AtomicReference<ReactApplicationContext?>(null)

    fun attach(context: ReactApplicationContext) {
        reactContextRef.set(context)
    }

    fun detach() {
        reactContextRef.set(null)
    }

    fun emitProgress(
        downloadId: String,
        modelId: String,
        fileName: String,
        bytesDownloaded: Long,
        totalBytes: Long,
        status: DownloadStatus,
        reason: DownloadReason = DownloadReason.NONE,
    ) {
        val payload = Arguments.createMap().apply {
            putString("downloadId", downloadId)
            putString("modelId", modelId)
            putString("fileName", fileName)
            putDouble("bytesDownloaded", bytesDownloaded.toDouble())
            putDouble("totalBytes", totalBytes.toDouble())
            putString("status", status.name)
            putString("reasonCode", reason.code)
        }
        emit("DownloadProgress", payload)
    }

    fun emitComplete(
        downloadId: String,
        modelId: String,
        fileName: String,
        destinationPath: String,
        totalBytes: Long,
    ) {
        val payload = Arguments.createMap().apply {
            putString("downloadId", downloadId)
            putString("modelId", modelId)
            putString("fileName", fileName)
            putString("destinationPath", destinationPath)
            putDouble("totalBytes", totalBytes.toDouble())
        }
        emit("DownloadComplete", payload)
    }

    fun emitError(
        downloadId: String,
        modelId: String,
        fileName: String,
        reason: DownloadReason,
        message: String?,
    ) {
        val payload = Arguments.createMap().apply {
            putString("downloadId", downloadId)
            putString("modelId", modelId)
            putString("fileName", fileName)
            putString("reasonCode", reason.code)
            putString("message", message ?: reason.code)
        }
        emit("DownloadError", payload)
    }

    private fun emit(eventName: String, payload: WritableMap) {
        val context = reactContextRef.get() ?: return
        if (!context.hasActiveReactInstance()) return
        try {
            context
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, payload)
        } catch (_: Throwable) {
            // Bridge died between hasActiveReactInstance() check and emit.
            // Safe to drop — JS will recover from Room state on next foreground.
        }
    }
}
