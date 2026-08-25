package dev.idcall.platform.screening

import dev.idcall.core.data.LookupCacheDataSource

data class ScreeningDecision(
    val displayLabel: String?,
    val shouldRefresh: Boolean,
    val reputationLevel: String? = null,
)

class ScreeningLookupResolver(
    private val cache: LookupCacheDataSource,
) {
    suspend fun resolve(number: String, nowEpochMs: Long): ScreeningDecision {
        val cached = cache.get(number) ?: return ScreeningDecision(null, shouldRefresh = true)
        return if (cached.isFresh(nowEpochMs)) {
            ScreeningDecision(
                displayLabel = cached.displayLabel,
                shouldRefresh = false,
                reputationLevel = cached.reputationLevel,
            )
        } else {
            ScreeningDecision(null, shouldRefresh = true)
        }
    }
}
