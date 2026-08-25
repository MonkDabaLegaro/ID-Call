package dev.idcall.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "lookup_history")
data class LookupHistoryEntity(
    @PrimaryKey val number: String,
    val displayLabel: String,
    val reputationLevel: String,
    val lastLookedUpEpochMs: Long,
    val lookupCount: Int,
)
