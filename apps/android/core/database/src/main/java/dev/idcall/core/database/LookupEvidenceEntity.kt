package dev.idcall.core.database

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index

@Entity(
    tableName = "lookup_evidence",
    primaryKeys = ["number", "provider", "field", "observedAtEpochMs"],
    foreignKeys = [
        ForeignKey(
            entity = LookupEntity::class,
            parentColumns = ["number"],
            childColumns = ["number"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("number")],
)
data class LookupEvidenceEntity(
    val number: String,
    val provider: String,
    val field: String,
    val confidence: Double,
    val observedAtEpochMs: Long,
)
