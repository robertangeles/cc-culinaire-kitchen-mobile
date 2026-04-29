package com.anonymous.ccculinairekitchenmob.download

import androidx.lifecycle.LiveData
import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

/**
 * Room DAO for the `downloads` table.
 *
 * LiveData methods exist for components that want lifecycle-aware
 * observation. Suspend methods exist for the Worker, which runs on
 * its own coroutine context and prefers direct awaits.
 */
@Dao
interface DownloadDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: DownloadEntity): Long

    @Query("SELECT * FROM downloads WHERE download_id = :downloadId LIMIT 1")
    suspend fun getByDownloadId(downloadId: String): DownloadEntity?

    @Query("SELECT * FROM downloads WHERE download_id = :downloadId LIMIT 1")
    fun observeByDownloadId(downloadId: String): LiveData<DownloadEntity?>

    @Query("SELECT * FROM downloads WHERE status IN ('QUEUED','RUNNING','PAUSED')")
    suspend fun getActiveDownloads(): List<DownloadEntity>

    @Query("SELECT * FROM downloads WHERE status IN ('QUEUED','RUNNING','PAUSED')")
    fun observeActiveDownloads(): LiveData<List<DownloadEntity>>

    @Query("UPDATE downloads SET bytes_downloaded = :bytes, status = :status, reason_code = :reason, updated_at = :now WHERE download_id = :downloadId")
    suspend fun updateProgress(
        downloadId: String,
        bytes: Long,
        status: DownloadStatus,
        reason: String,
        now: Long = System.currentTimeMillis(),
    )

    @Query("UPDATE downloads SET status = :status, reason_code = :reason, updated_at = :now WHERE download_id = :downloadId")
    suspend fun updateStatus(
        downloadId: String,
        status: DownloadStatus,
        reason: String,
        now: Long = System.currentTimeMillis(),
    )

    @Query("UPDATE downloads SET work_id = :workId, updated_at = :now WHERE download_id = :downloadId")
    suspend fun setWorkId(
        downloadId: String,
        workId: String,
        now: Long = System.currentTimeMillis(),
    )

    @Query("UPDATE downloads SET total_bytes = :totalBytes, updated_at = :now WHERE download_id = :downloadId")
    suspend fun updateTotalBytes(
        downloadId: String,
        totalBytes: Long,
        now: Long = System.currentTimeMillis(),
    )

    @Query("DELETE FROM downloads WHERE download_id = :downloadId")
    suspend fun deleteByDownloadId(downloadId: String)

    @Query("DELETE FROM downloads")
    suspend fun deleteAll()
}
