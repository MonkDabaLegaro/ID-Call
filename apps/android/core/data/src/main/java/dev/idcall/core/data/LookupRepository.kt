package dev.idcall.core.data

import dev.idcall.core.model.LookupRecord
import dev.idcall.core.model.LookupResult

interface LookupRepository {
    suspend fun lookup(number: String): LookupResult
    suspend fun refresh(number: String): LookupResult
}

interface LookupCacheDataSource {
    suspend fun get(number: String): LookupRecord?
    suspend fun put(record: LookupRecord)
}

interface LookupRemoteDataSource {
    suspend fun lookup(number: String): LookupRecord
}
