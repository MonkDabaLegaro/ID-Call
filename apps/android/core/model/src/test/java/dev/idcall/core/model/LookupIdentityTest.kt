package dev.idcall.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

class LookupIdentityTest {
    private val now = 1_777_000_000_000L

    @Test
    fun `display label prefers unexpired verified business identity`() {
        val record = LookupRecord(
            number = "+56912345678",
            countryCode = "56",
            nationalNumber = "912345678",
            regionCode = "CL",
            numberType = "MOBILE",
            identity = LookupIdentity(
                displayName = "Example Business",
                identityType = "verified-business",
                verification = "verified",
                confidence = 0.95,
                publicWebsite = "https://example.com",
                publicAddress = null,
                expiresAtEpochMs = now + 10_000,
            ),
            locationLabel = "CL",
            locationPrecision = "country",
            locationDisclaimer = "metadata only",
            reputationScore = 0.0,
            reputationLevel = "unknown",
            reputationReports = 0,
            evidence = emptyList(),
            cachedAtEpochMs = now,
        )

        assertEquals("Example Business", record.displayLabel(now))
    }

    @Test
    fun `expired identity falls back to numbering label`() {
        val record = LookupRecord(
            number = "+56912345678",
            countryCode = "56",
            nationalNumber = "912345678",
            regionCode = "CL",
            numberType = "MOBILE",
            identity = LookupIdentity(
                displayName = "Old Business",
                identityType = "verified-business",
                verification = "verified",
                confidence = 0.95,
                publicWebsite = null,
                publicAddress = null,
                expiresAtEpochMs = now - 1,
            ),
            locationLabel = "CL",
            locationPrecision = "country",
            locationDisclaimer = "metadata only",
            reputationScore = 0.0,
            reputationLevel = "unknown",
            reputationReports = 0,
            evidence = emptyList(),
            cachedAtEpochMs = now,
        )

        assertEquals("CL", record.displayLabel(now))
    }
}
