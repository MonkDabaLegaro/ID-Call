package dev.idcall.core.data

import dev.idcall.core.model.LookupHistoryItem
import dev.idcall.core.model.LookupRecord
import dev.idcall.core.model.LookupResult

interface LookupRepository {
    suspend fun lookup(number: String): LookupResult
    suspend fun refresh(number: String): LookupResult
    suspend fun report(number: String, category: String): LookupResult
    suspend fun recentHistory(limit: Int = 10): List<LookupHistoryItem>
}

interface LookupCacheDataSource {
    suspend fun get(number: String): LookupRecord?
    suspend fun put(record: LookupRecord)
}

interface LookupRemoteDataSource {
    suspend fun lookup(number: String): LookupRecord
    suspend fun report(number: String, category: String) {
        error("Reporting is not supported by this remote data source")
    }
}

interface LookupHistoryDataSource {
    suspend fun record(record: LookupRecord, lookedUpAtEpochMs: Long)
    suspend fun recent(limit: Int): List<LookupHistoryItem>
}

object NoOpLookupHistoryDataSource : LookupHistoryDataSource {
    override suspend fun record(record: LookupRecord, lookedUpAtEpochMs: Long) = Unit
    override suspend fun recent(limit: Int): List<LookupHistoryItem> = emptyList()
}
