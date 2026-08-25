package dev.idcall.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [LookupEntity::class, LookupEvidenceEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class LookupDatabase : RoomDatabase() {
    abstract fun lookupDao(): LookupDao

    companion object {
        @Volatile private var instance: LookupDatabase? = null

        fun get(context: Context): LookupDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                LookupDatabase::class.java,
                "id-call.db",
            ).build().also { instance = it }
        }
    }
}
