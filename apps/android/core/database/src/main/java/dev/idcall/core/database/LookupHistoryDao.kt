package dev.idcall.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface LookupHistoryDao {
    @Query("SELECT * FROM lookup_history WHERE number = :number LIMIT 1")
    suspend fun find(number: String): LookupHistoryEntity?

    @Query("SELECT * FROM lookup_history ORDER BY lastLookedUpEpochMs DESC LIMIT :limit")
    suspend fun recent(limit: Int): List<LookupHistoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: LookupHistoryEntity)
}
