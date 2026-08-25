package dev.idcall.core.data

import dev.idcall.core.model.LookupEvidence
import dev.idcall.core.model.LookupRecord
import dev.idcall.core.network.LookupApi
import dev.idcall.core.network.ReportRequestDto
import java.time.Instant
import retrofit2.HttpException

class RetrofitLookupRemoteDataSource(
    private val api: LookupApi,
    private val reporterSessionManager: ReporterSessionManager,
) : LookupRemoteDataSource {
    override suspend fun lookup(number: String): LookupRecord {
        val dto = api.lookup(number)
        return LookupRecord(
            number = dto.number,
            countryCode = dto.countryCode,
            nationalNumber = dto.nationalNumber,
            regionCode = dto.regionCode,
            numberType = dto.numberType,
            locationLabel = dto.location.label,
            locationPrecision = dto.location.precision,
            locationDisclaimer = dto.location.disclaimer,
            reputationScore = dto.reputation.score,
            reputationLevel = dto.reputation.level,
            reputationReports = dto.reputation.reports,
            evidence = dto.sources.map {
                LookupEvidence(
                    provider = it.provider,
                    field = it.field,
                    confidence = it.confidence,
                    observedAtEpochMs = Instant.parse(it.observedAt).toEpochMilli(),
                )
            },
            cachedAtEpochMs = Instant.parse(dto.cachedAt).toEpochMilli(),
        )
    }

    override suspend fun report(number: String, category: String) {
        val request = ReportRequestDto(phoneNumber = number, category = category)
        val firstSession = reporterSessionManager.session()
        try {
            api.report("Bearer ${firstSession.token}", request)
        } catch (error: HttpException) {
            if (error.code() != 401) throw error
            reporterSessionManager.invalidate()
            val replacement = reporterSessionManager.session()
            api.report("Bearer ${replacement.token}", request)
        }
    }
}
