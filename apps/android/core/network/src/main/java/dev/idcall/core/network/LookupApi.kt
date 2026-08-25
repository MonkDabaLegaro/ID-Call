package dev.idcall.core.network

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path

interface LookupApi {
    @GET("v1/lookup/{phoneNumber}")
    suspend fun lookup(@Path("phoneNumber") phoneNumber: String): LookupResponseDto

    @POST("v1/reporters")
    suspend fun registerReporter(): ReporterRegistrationResponseDto

    @POST("v1/reports")
    suspend fun report(
        @Header("Authorization") authorization: String,
        @Body request: ReportRequestDto,
    ): ReportResponseDto

    @DELETE("v1/reports/{reportId}")
    suspend fun withdrawReport(
        @Header("Authorization") authorization: String,
        @Path("reportId") reportId: String,
    )

    @POST("v1/corrections")
    suspend fun correction(
        @Header("Authorization") authorization: String,
        @Body request: CorrectionRequestDto,
    ): CorrectionResponseDto
}
