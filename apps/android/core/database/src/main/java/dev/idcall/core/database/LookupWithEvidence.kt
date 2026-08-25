package dev.idcall.core.database

import androidx.room.Embedded
import androidx.room.Relation

data class LookupWithEvidence(
    @Embedded val record: LookupEntity,
    @Relation(parentColumn = "number", entityColumn = "number")
    val evidence: List<LookupEvidenceEntity>,
)
