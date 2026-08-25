package dev.idcall.app.screening

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreeningCachePolicyTest {
    private val policy = ScreeningCachePolicy(maxAgeMs = 1_000)

    @Test
    fun freshEntryIsUsable() {
        assertTrue(policy.isUsable(CachedLookup("+56912345678", "Chile", 1_000), 1_500))
    }

    @Test
    fun staleEntryIsRejected() {
        assertFalse(policy.isUsable(CachedLookup("+56912345678", "Chile", 1_000), 2_001))
    }

    @Test
    fun futureDatedEntryIsRejected() {
        assertFalse(policy.isUsable(CachedLookup("+56912345678", "Chile", 2_000), 1_000))
    }
}
