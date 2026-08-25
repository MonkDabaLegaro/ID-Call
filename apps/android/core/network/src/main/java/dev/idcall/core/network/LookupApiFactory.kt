package dev.idcall.core.network

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object LookupApiFactory {
    fun create(baseUrl: String): LookupApi = Retrofit.Builder()
        .baseUrl(baseUrl)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(LookupApi::class.java)
}
