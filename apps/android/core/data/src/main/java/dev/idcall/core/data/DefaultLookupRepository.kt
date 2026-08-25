package dev.idcall.core.data

import dev.idcall.core.model.LookupHistoryItem
import dev.idcall.core.model.LookupOrigin
import dev.idcall.core.model.LookupResult

class DefaultLookupRepository(
    private val cache: LookupCacheDataSource,
    private val remote: LookupRemoteDataSource,
    private val nowEpochMs: () -> Long = System::currentTimeMillis,
    private val history: LookupHistoryDataSource = NoOpLookupHistoryDataSource,
) : LookupRepository {
    override suspend fun lookup(number: String): LookupResult {
        val cached = cache.get(number)
        val now = nowEpochMs()
        val result = if (cached != null && cached.isFresh(now)) {
            LookupResult(cached, LookupOrigin.FRESH_CACHE)
        } else {
            try {
                val refreshed = remote.lookup(number)
                cache.put(refreshed)
                LookupResult(refreshed, LookupOrigin.NETWORK)
            } catch (error: Throwable) {
                if (cached != null) LookupResult(cached, LookupOrigin.STALE_CACHE) else throw error
            }
        }
        history.record(result.record, now)
        return result
    }

    override suspend fun refresh(number: String): LookupResult {
        val refreshed = remote.lookup(number)
        cache.put(refreshed)
        return LookupResult(refreshed, LookupOrigin.NETWORK)
    }

    override suspend fun report(number: String, category: String): LookupResult {
        remote.report(number, category)
        val refreshed = remote.lookup(number)
        cache.put(refreshed)
        history.record(refreshed, nowEpochMs())
        return LookupResult(refreshed, LookupOrigin.NETWORK)
    }

    override suspend fun recentHistory(limit: Int): List<LookupHistoryItem> = history.recent(limit)
}
