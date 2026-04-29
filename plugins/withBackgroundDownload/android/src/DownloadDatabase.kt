package com.anonymous.ccculinairekitchenmob.download

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters

/**
 * Room singleton for the download persistence layer.
 *
 * Schema version 1. Bump this and provide a Migration if you add or
 * change columns — fallbackToDestructiveMigration() would lose
 * in-flight downloads on a version mismatch, which is unacceptable
 * for a 6 GB download that the user has already waited 20 min for.
 */
@Database(
    entities = [DownloadEntity::class],
    version = 1,
    exportSchema = false,
)
@TypeConverters(DownloadConverters::class)
abstract class DownloadDatabase : RoomDatabase() {

    abstract fun downloadDao(): DownloadDao

    companion object {
        @Volatile
        private var INSTANCE: DownloadDatabase? = null

        fun getInstance(context: Context): DownloadDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    DownloadDatabase::class.java,
                    "ckm_downloads.db",
                ).build().also { INSTANCE = it }
            }
        }
    }
}

/**
 * Stores DownloadStatus enums as their .name string in SQLite.
 * Keeps the schema human-readable when inspecting via `sqlite3` over adb.
 */
class DownloadConverters {
    @TypeConverter
    fun fromStatus(status: DownloadStatus): String = status.name

    @TypeConverter
    fun toStatus(value: String): DownloadStatus =
        runCatching { DownloadStatus.valueOf(value) }.getOrDefault(DownloadStatus.QUEUED)
}
