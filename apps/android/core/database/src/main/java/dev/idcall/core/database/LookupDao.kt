package dev.idcall.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

@Dao
interface LookupDao {
    @Transaction
    @Query("SELECT * FROM lookup_records WHERE number = :number LIMIT 1")
    suspend fun find(number: String): LookupWithEvidence?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertRecord(record: LookupEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvidence(evidence: List<LookupEvidenceEntity>)

    @Query("DELETE FROM lookup_evidence WHERE number = :number")
    suspend fun deleteEvidence(number: String)

    @Transaction
    suspend fun replace(record: LookupEntity, evidence: List<LookupEvidenceEntity>) {
        upsertRecord(record)
        deleteEvidence(record.number)
        if (evidence.isNotEmpty()) insertEvidence(evidence)
    }
}
