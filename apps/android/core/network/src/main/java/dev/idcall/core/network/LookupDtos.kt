package dev.idcall.core.network

data class EvidenceDto(
    val provider: String,
    val field: String,
    val confidence: Double,
    val observedAt: String,
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
    val location: LocationDto,
    val reputation: ReputationDto,
    val sources: List<EvidenceDto>,
    val cachedAt: String,
)

data class ReportRequestDto(
    val phoneNumber: String,
    val category: String,
)

data class ReportResponseDto(
    val number: String,
    val category: String,
    val reputation: ReputationDto,
)
