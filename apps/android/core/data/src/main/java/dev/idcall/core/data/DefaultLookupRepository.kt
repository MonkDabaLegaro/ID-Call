package dev.idcall.core.data

import dev.idcall.core.model.LookupOrigin
import dev.idcall.core.model.LookupResult

class DefaultLookupRepository(
    private val cache: LookupCacheDataSource,
    private val remote: LookupRemoteDataSource,
    private val nowEpochMs: () -> Long = System::currentTimeMillis,
) : LookupRepository {
    override suspend fun lookup(number: String): LookupResult {
        val cached = cache.get(number)
        val now = nowEpochMs()
        if (cached != null && cached.isFresh(now)) {
            return LookupResult(cached, LookupOrigin.FRESH_CACHE)
        }

        return try {
            val refreshed = remote.lookup(number)
            cache.put(refreshed)
            LookupResult(refreshed, LookupOrigin.NETWORK)
        } catch (error: Throwable) {
            if (cached != null) LookupResult(cached, LookupOrigin.STALE_CACHE) else throw error
        }
    }

    override suspend fun refresh(number: String): LookupResult {
        val refreshed = remote.lookup(number)
        cache.put(refreshed)
        return LookupResult(refreshed, LookupOrigin.NETWORK)
    }
}
