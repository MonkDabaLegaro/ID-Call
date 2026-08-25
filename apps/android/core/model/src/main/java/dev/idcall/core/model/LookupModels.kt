package dev.idcall.core.model

private const val DEFAULT_FRESHNESS_MS = 24 * 60 * 60 * 1000L

data class LookupEvidence(
    val provider: String,
    val field: String,
    val confidence: Double,
    val observedAtEpochMs: Long,
)

data class LookupIdentity(
    val displayName: String,
    val identityType: String,
    val verification: String,
    val confidence: Double,
    val publicWebsite: String?,
    val publicAddress: String?,
    val expiresAtEpochMs: Long?,
) {
    fun isActive(nowEpochMs: Long): Boolean = expiresAtEpochMs == null || expiresAtEpochMs > nowEpochMs
}

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
    val identity: LookupIdentity? = null,
) {
    fun isFresh(nowEpochMs: Long, maxAgeMs: Long = DEFAULT_FRESHNESS_MS): Boolean {
        if (nowEpochMs < cachedAtEpochMs) return false
        return nowEpochMs - cachedAtEpochMs <= maxAgeMs
    }

    fun displayLabel(nowEpochMs: Long): String =
        identity?.takeIf { it.isActive(nowEpochMs) }?.displayName
            ?: locationLabel
            ?: regionCode
            ?: number

    val displayLabel: String
        get() = displayLabel(System.currentTimeMillis())
}

data class LookupHistoryItem(
    val number: String,
    val displayLabel: String,
    val reputationLevel: String,
    val lastLookedUpEpochMs: Long,
    val lookupCount: Int,
)

enum class LookupOrigin {
    FRESH_CACHE,
    NETWORK,
    STALE_CACHE,
}

data class LookupResult(
    val record: LookupRecord,
    val origin: LookupOrigin,
)
