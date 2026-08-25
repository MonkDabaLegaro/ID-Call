package dev.idcall.core.data

import dev.idcall.core.database.LookupDao
import dev.idcall.core.database.LookupEntity
import dev.idcall.core.database.LookupEvidenceEntity
import dev.idcall.core.model.LookupEvidence
import dev.idcall.core.model.LookupIdentity
import dev.idcall.core.model.LookupRecord

class RoomLookupCacheDataSource(
    private val dao: LookupDao,
) : LookupCacheDataSource {
    override suspend fun get(number: String): LookupRecord? = dao.find(number)?.let { row ->
        val storedIdentity = row.record.identityDisplayName?.let { displayName ->
            LookupIdentity(
                displayName = displayName,
                identityType = row.record.identityType ?: "verified-business",
                verification = row.record.identityVerification ?: "verified",
                confidence = row.record.identityConfidence ?: 0.0,
                publicWebsite = row.record.identityPublicWebsite,
                publicAddress = row.record.identityPublicAddress,
                expiresAtEpochMs = row.record.identityExpiresAtEpochMs,
            )
        }
        LookupRecord(
            number = row.record.number,
            countryCode = row.record.countryCode,
            nationalNumber = row.record.nationalNumber,
            regionCode = row.record.regionCode,
            numberType = row.record.numberType,
            identity = storedIdentity,
            locationLabel = row.record.locationLabel,
            locationPrecision = row.record.locationPrecision,
            locationDisclaimer = row.record.locationDisclaimer,
            reputationScore = row.record.reputationScore,
            reputationLevel = row.record.reputationLevel,
            reputationReports = row.record.reputationReports,
            evidence = row.evidence.map {
                LookupEvidence(it.provider, it.field, it.confidence, it.observedAtEpochMs)
            },
            cachedAtEpochMs = row.record.cachedAtEpochMs,
        )
    }

    override suspend fun put(record: LookupRecord) {
        dao.replace(
            record = LookupEntity(
                number = record.number,
                countryCode = record.countryCode,
                nationalNumber = record.nationalNumber,
                regionCode = record.regionCode,
                numberType = record.numberType,
                identityDisplayName = record.identity?.displayName,
                identityType = record.identity?.identityType,
                identityVerification = record.identity?.verification,
                identityConfidence = record.identity?.confidence,
                identityPublicWebsite = record.identity?.publicWebsite,
                identityPublicAddress = record.identity?.publicAddress,
                identityExpiresAtEpochMs = record.identity?.expiresAtEpochMs,
                locationLabel = record.locationLabel,
                locationPrecision = record.locationPrecision,
                locationDisclaimer = record.locationDisclaimer,
                reputationScore = record.reputationScore,
                reputationLevel = record.reputationLevel,
                reputationReports = record.reputationReports,
                cachedAtEpochMs = record.cachedAtEpochMs,
            ),
            evidence = record.evidence.map {
                LookupEvidenceEntity(record.number, it.provider, it.field, it.confidence, it.observedAtEpochMs)
            },
        )
    }
}
