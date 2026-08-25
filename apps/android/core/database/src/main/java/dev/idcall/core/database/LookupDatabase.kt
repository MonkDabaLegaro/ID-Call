package dev.idcall.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [LookupEntity::class, LookupEvidenceEntity::class, LookupHistoryEntity::class],
    version = 2,
    exportSchema = true,
)
abstract class LookupDatabase : RoomDatabase() {
    abstract fun lookupDao(): LookupDao
    abstract fun historyDao(): LookupHistoryDao

    companion object {
        @Volatile private var instance: LookupDatabase? = null

        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS `lookup_history` (
                        `number` TEXT NOT NULL,
                        `displayLabel` TEXT NOT NULL,
                        `reputationLevel` TEXT NOT NULL,
                        `lastLookedUpEpochMs` INTEGER NOT NULL,
                        `lookupCount` INTEGER NOT NULL,
                        PRIMARY KEY(`number`)
                    )""".trimIndent()
                )
            }
        }

        fun get(context: Context): LookupDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                LookupDatabase::class.java,
                "id-call.db",
            ).addMigrations(MIGRATION_1_2)
                .build()
                .also { instance = it }
        }
    }
}
