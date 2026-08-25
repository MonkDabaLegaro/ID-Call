package dev.idcall.platform.screening

import dev.idcall.core.data.LookupCacheDataSource
import dev.idcall.core.model.LookupRecord
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreeningLookupResolverTest {
    private val now = 2_000_000_000_000L

    @Test
    fun freshCacheProvidesLabelWithoutRefresh() = runTest {
        val resolver = ScreeningLookupResolver(FakeCache(record(now - 1_000)))

        val decision = resolver.resolve("+56223456789", now)

        assertEquals("Santiago", decision.displayLabel)
        assertFalse(decision.shouldRefresh)
    }

    @Test
    fun staleCacheIsNotAuthoritativeAndRequestsRefresh() = runTest {
        val resolver = ScreeningLookupResolver(FakeCache(record(now - 25 * 60 * 60 * 1000L)))

        val decision = resolver.resolve("+56223456789", now)

        assertNull(decision.displayLabel)
        assertTrue(decision.shouldRefresh)
    }

    @Test
    fun cacheMissFailsOpenAndRequestsRefresh() = runTest {
        val resolver = ScreeningLookupResolver(FakeCache(null))

        val decision = resolver.resolve("+56223456789", now)

        assertNull(decision.displayLabel)
        assertTrue(decision.shouldRefresh)
    }

    private fun record(cachedAt: Long) = LookupRecord(
        number = "+56223456789",
        countryCode = "56",
        nationalNumber = "223456789",
        regionCode = "CL",
        numberType = "FIXED_LINE",
        locationLabel = "Santiago",
        locationPrecision = "numbering-region",
        locationDisclaimer = "Not live location",
        reputationScore = 0.0,
        reputationLevel = "unknown",
        reputationReports = 0,
        evidence = emptyList(),
        cachedAtEpochMs = cachedAt,
    )

    private class FakeCache(private val record: LookupRecord?) : LookupCacheDataSource {
        override suspend fun get(number: String): LookupRecord? = record
        override suspend fun put(record: LookupRecord) = Unit
    }
}
