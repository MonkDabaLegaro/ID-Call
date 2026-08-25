package dev.idcall.core.data

import dev.idcall.core.database.LookupHistoryDao
import dev.idcall.core.database.LookupHistoryEntity
import dev.idcall.core.model.LookupHistoryItem
import dev.idcall.core.model.LookupRecord

class RoomLookupHistoryDataSource(
    private val dao: LookupHistoryDao,
) : LookupHistoryDataSource {
    override suspend fun record(record: LookupRecord, lookedUpAtEpochMs: Long) {
        val previous = dao.find(record.number)
        dao.upsert(
            LookupHistoryEntity(
                number = record.number,
                displayLabel = record.displayLabel,
                reputationLevel = record.reputationLevel,
                lastLookedUpEpochMs = lookedUpAtEpochMs,
                lookupCount = (previous?.lookupCount ?: 0) + 1,
            )
        )
    }

    override suspend fun recent(limit: Int): List<LookupHistoryItem> =
        dao.recent(limit.coerceAtLeast(0)).map {
            LookupHistoryItem(
                number = it.number,
                displayLabel = it.displayLabel,
                reputationLevel = it.reputationLevel,
                lastLookedUpEpochMs = it.lastLookedUpEpochMs,
                lookupCount = it.lookupCount,
            )
        }
}
