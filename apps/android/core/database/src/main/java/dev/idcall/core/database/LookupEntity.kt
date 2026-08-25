package dev.idcall.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "lookup_records")
data class LookupEntity(
    @PrimaryKey val number: String,
    val countryCode: String,
    val nationalNumber: String,
    val regionCode: String?,
    val numberType: String?,
    val identityDisplayName: String?,
    val identityType: String?,
    val identityVerification: String?,
    val identityConfidence: Double?,
    val identityPublicWebsite: String?,
    val identityPublicAddress: String?,
    val identityExpiresAtEpochMs: Long?,
    val locationLabel: String?,
    val locationPrecision: String,
    val locationDisclaimer: String,
    val reputationScore: Double,
    val reputationLevel: String,
    val reputationReports: Int,
    val cachedAtEpochMs: Long,
)
