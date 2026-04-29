package com.anonymous.ccculinairekitchenmob.download

/**
 * Lifecycle status of a single download row.
 *
 * Stored in the Room `downloads` table; mapped to JS-facing strings
 * in DownloadEventBridge.
 */
enum class DownloadStatus {
    QUEUED,
    RUNNING,
    PAUSED,
    COMPLETED,
    FAILED,
    CANCELLED,
}

/**
 * Reason code for a non-progress event (failure, retry, network wait).
 *
 * Strings match the JS-side type union in
 * `src/services/types/backgroundDownload.ts`. JS uses these to decide
 * what error message to show the user (e.g. NETWORK_LOST -> "waiting
 * for connection", DISK_FULL -> "free up space").
 */
enum class DownloadReason(val code: String) {
    NONE("none"),
    NETWORK_LOST("network_lost"),
    NETWORK_TIMEOUT("network_timeout"),
    SERVER_UNAVAILABLE("server_unavailable"),
    DOWNLOAD_INTERRUPTED("download_interrupted"),
    DISK_FULL("disk_full"),
    FILE_CORRUPTED("file_corrupted"),
    EMPTY_RESPONSE("empty_response"),
    USER_CANCELLED("user_cancelled"),
    HTTP_401("http_401"),
    HTTP_403("http_403"),
    HTTP_404("http_404"),
    HTTP_416("http_416"),
    CLIENT_ERROR("client_error"),
    UNKNOWN_ERROR("unknown_error"),
}

/**
 * Maps Java/Kotlin exceptions to a DownloadReason for JS consumption.
 *
 * Centralizes the messy "what kind of network failure was this" logic
 * so the worker stays readable. Exception types that imply "the
 * connection might come back" -> NETWORK_LOST. Connection refused or
 * SSL failures -> NETWORK_LOST. Timeouts -> NETWORK_TIMEOUT.
 */
fun classifyException(throwable: Throwable): DownloadReason = when (throwable) {
    is java.net.SocketTimeoutException -> DownloadReason.NETWORK_TIMEOUT
    is java.net.UnknownHostException,
    is java.net.ConnectException,
    is java.net.SocketException,
    is javax.net.ssl.SSLException,
    -> DownloadReason.NETWORK_LOST
    is java.io.EOFException -> DownloadReason.DOWNLOAD_INTERRUPTED
    else -> DownloadReason.UNKNOWN_ERROR
}

/**
 * Maps HTTP status codes to a DownloadReason. 5xx -> server unavailable
 * (retry-friendly). 4xx -> client error (mostly permanent, with specific
 * codes for the common cases the user might fix).
 */
fun classifyHttpStatus(status: Int): DownloadReason = when (status) {
    401 -> DownloadReason.HTTP_401
    403 -> DownloadReason.HTTP_403
    404 -> DownloadReason.HTTP_404
    416 -> DownloadReason.HTTP_416
    in 500..599 -> DownloadReason.SERVER_UNAVAILABLE
    in 400..499 -> DownloadReason.CLIENT_ERROR
    else -> DownloadReason.UNKNOWN_ERROR
}
