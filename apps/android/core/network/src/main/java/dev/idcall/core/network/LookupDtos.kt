package dev.idcall.core.network

data class EvidenceDto(
    val provider: String,
    val field: String,
    val confidence: Double,
    val observedAt: String,
)

data class CallerIdentityDto(
    val displayName: String,
    val identityType: String,
    val verification: String,
    val confidence: Double,
    val publicWebsite: String?,
    val publicAddress: String?,
    val expiresAt: String?,
)

data class LocationDto(
    val label: String?,
    val precision: String,
    val disclaimer: String,
)

data class ReputationDto(
    val score: Double,
    val level: String,
    val reports: Int,
)

data class LookupResponseDto(
    val number: String,
    val valid: Boolean,
    val countryCode: String,
    val nationalNumber: String,
    val regionCode: String?,
    val numberType: String?,
    val identity: CallerIdentityDto?,
    val location: LocationDto,
    val reputation: ReputationDto,
    val sources: List<EvidenceDto>,
    val cachedAt: String,
)

data class ReporterRegistrationResponseDto(
    val reporterId: String,
    val token: String,
)

data class ReportRequestDto(
    val phoneNumber: String,
    val category: String,
)

data class ReportResponseDto(
    val reportId: String,
    val number: String,
    val category: String,
    val reputation: ReputationDto,
)

data class CorrectionRequestDto(
    val phoneNumber: String,
    val kind: String,
    val reason: String? = null,
)

data class CorrectionResponseDto(
    val correctionId: String,
    val status: String,
)
