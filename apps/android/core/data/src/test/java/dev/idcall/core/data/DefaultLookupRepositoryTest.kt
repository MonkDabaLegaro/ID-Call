package dev.idcall.core.data

import dev.idcall.core.model.LookupEvidence
import dev.idcall.core.model.LookupHistoryItem
import dev.idcall.core.model.LookupOrigin
import dev.idcall.core.model.LookupRecord
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class DefaultLookupRepositoryTest {
    private val now = 2_000_000_000_000L

    @Test
    fun freshCacheSkipsNetworkAndRecordsHistory() = runTest {
        val cached = record(cachedAt = now - 1_000)
        val cache = FakeCache(cached)
        val remote = FakeRemote(record(cachedAt = now))
        val history = FakeHistory()
        val repository = DefaultLookupRepository(cache, remote, nowEpochMs = { now }, history = history)

        val result = repository.lookup(cached.number)

        assertEquals(LookupOrigin.FRESH_CACHE, result.origin)
        assertSame(cached, result.record)
        assertEquals(0, remote.calls)
        assertEquals(listOf(cached.number), history.recorded.map { it.number })
    }

    @Test
    fun staleCacheRefreshesAndPersistsNetworkValue() = runTest {
        val stale = record(cachedAt = now - 25 * 60 * 60 * 1000L)
        val fresh = record(cachedAt = now, location = "CL")
        val cache = FakeCache(stale)
        val remote = FakeRemote(fresh)
        val repository = DefaultLookupRepository(cache, remote, nowEpochMs = { now })

        val result = repository.lookup(stale.number)

        assertEquals(LookupOrigin.NETWORK, result.origin)
        assertSame(fresh, result.record)
        assertSame(fresh, cache.value)
        assertEquals(1, remote.calls)
    }

    @Test
    fun networkFailureFallsBackToStaleCache() = runTest {
        val stale = record(cachedAt = now - 25 * 60 * 60 * 1000L)
        val cache = FakeCache(stale)
        val remote = FakeRemote(error = IllegalStateException("offline"))
        val repository = DefaultLookupRepository(cache, remote, nowEpochMs = { now })

        val result = repository.lookup(stale.number)

        assertEquals(LookupOrigin.STALE_CACHE, result.origin)
        assertSame(stale, result.record)
    }

    @Test
    fun reportRefreshesReputationAndCache() = runTest {
        val updated = record(cachedAt = now).copy(reputationLevel = "medium", reputationReports = 1)
        val cache = FakeCache(null)
        val remote = FakeRemote(updated)
        val repository = DefaultLookupRepository(cache, remote, nowEpochMs = { now })

        val result = repository.report(updated.number, "scam")

        assertEquals("scam", remote.reportedCategory)
        assertEquals("medium", result.record.reputationLevel)
        assertSame(updated, cache.value)
    }

    private fun record(cachedAt: Long, location: String? = "Santiago") = LookupRecord(
        number = "+56223456789",
        countryCode = "56",
        nationalNumber = "223456789",
        regionCode = "CL",
        numberType = "FIXED_LINE",
        locationLabel = location,
        locationPrecision = "numbering-region",
        locationDisclaimer = "Not live location",
        reputationScore = 0.0,
        reputationLevel = "unknown",
        reputationReports = 0,
        evidence = listOf(LookupEvidence("test", "number-metadata", 1.0, cachedAt)),
        cachedAtEpochMs = cachedAt,
    )

    private class FakeCache(var value: LookupRecord?) : LookupCacheDataSource {
        override suspend fun get(number: String): LookupRecord? = value
        override suspend fun put(record: LookupRecord) { value = record }
    }

    private class FakeHistory : LookupHistoryDataSource {
        val recorded = mutableListOf<LookupRecord>()
        override suspend fun record(record: LookupRecord, lookedUpAtEpochMs: Long) { recorded += record }
        override suspend fun recent(limit: Int): List<LookupHistoryItem> = emptyList()
    }

    private class FakeRemote(
        private val value: LookupRecord? = null,
        private val error: Throwable? = null,
    ) : LookupRemoteDataSource {
        var calls = 0
        var reportedCategory: String? = null
        override suspend fun lookup(number: String): LookupRecord {
            calls++
            error?.let { throw it }
            return requireNotNull(value)
        }
        override suspend fun report(number: String, category: String) {
            reportedCategory = category
        }
    }
}
