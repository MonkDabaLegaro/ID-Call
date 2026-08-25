package dev.idcall.core.network

import retrofit2.http.GET
import retrofit2.http.Path

interface LookupApi {
    @GET("v1/lookup/{phoneNumber}")
    suspend fun lookup(@Path("phoneNumber") phoneNumber: String): LookupResponseDto
}
