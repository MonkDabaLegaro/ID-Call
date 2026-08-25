package dev.idcall.core.model

private const val DEFAULT_FRESHNESS_MS = 24 * 60 * 60 * 1000L

data class LookupEvidence(
    val provider: String,
    val field: String,
    val confidence: Double,
    val observedAtEpochMs: Long,
)

data class LookupRecord(
    val number: String,
    val countryCode: String,
    val nationalNumber: String,
    val regionCode: String?,
    val numberType: String?,
    val locationLabel: String?,
    val locationPrecision: String,
    val locationDisclaimer: String,
    val reputationScore: Double,
    val reputationLevel: String,
    val reputationReports: Int,
    val evidence: List<LookupEvidence>,
    val cachedAtEpochMs: Long,
) {
    fun isFresh(nowEpochMs: Long, maxAgeMs: Long = DEFAULT_FRESHNESS_MS): Boolean {
        if (nowEpochMs < cachedAtEpochMs) return false
        return nowEpochMs - cachedAtEpochMs <= maxAgeMs
    }

    val displayLabel: String
        get() = locationLabel ?: regionCode ?: number
}

enum class LookupOrigin {
    FRESH_CACHE,
    NETWORK,
    STALE_CACHE,
}

data class LookupResult(
    val record: LookupRecord,
    val origin: LookupOrigin,
)
