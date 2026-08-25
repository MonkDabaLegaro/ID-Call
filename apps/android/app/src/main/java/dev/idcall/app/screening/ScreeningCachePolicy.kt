package dev.idcall.app.screening

private const val DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000L

data class CachedLookup(
    val number: String,
    val displayLabel: String?,
    val storedAtEpochMs: Long
)

class ScreeningCachePolicy(
    private val maxAgeMs: Long = DEFAULT_MAX_AGE_MS
) {
    fun isUsable(entry: CachedLookup, nowEpochMs: Long): Boolean {
        if (nowEpochMs < entry.storedAtEpochMs) return false
        return nowEpochMs - entry.storedAtEpochMs <= maxAgeMs
    }
}
