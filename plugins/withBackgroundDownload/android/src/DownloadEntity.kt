package com.anonymous.ccculinairekitchenmob.download

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One row per file in flight.
 *
 * Persisted in the Room `downloads` table so that an in-progress
 * download survives process death — when the user force-stops the app
 * mid-download, we re-read this row on next start and the WorkManager
 * job resumes from `bytesDownloaded` via an HTTP Range request.
 *
 * `downloadId` is the JS-facing handle (UUID generated when JS calls
 * startDownload) — distinct from the Room primary key so JS can
 * reference a download before Room has assigned an `id`.
 */
@Entity(tableName = "downloads")
data class DownloadEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "download_id")
    val downloadId: String,

    @ColumnInfo(name = "model_id")
    val modelId: String,

    @ColumnInfo(name = "file_name")
    val fileName: String,

    val url: String,

    @ColumnInfo(name = "destination_path")
    val destinationPath: String,

    @ColumnInfo(name = "expected_sha256")
    val expectedSha256: String?,

    @ColumnInfo(name = "total_bytes")
    val totalBytes: Long,

    @ColumnInfo(name = "bytes_downloaded")
    val bytesDownloaded: Long = 0,

    val status: DownloadStatus = DownloadStatus.QUEUED,

    @ColumnInfo(name = "reason_code")
    val reasonCode: String = DownloadReason.NONE.code,

    @ColumnInfo(name = "work_id")
    val workId: String? = null,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis(),
)
