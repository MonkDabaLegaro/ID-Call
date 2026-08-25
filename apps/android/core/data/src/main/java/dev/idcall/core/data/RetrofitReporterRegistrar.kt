package dev.idcall.core.data

import dev.idcall.core.network.LookupApi

class RetrofitReporterRegistrar(
    private val api: LookupApi,
) : ReporterRegistrar {
    override suspend fun registerReporter(): ReporterSession {
        val response = api.registerReporter()
        return ReporterSession(
            reporterId = response.reporterId,
            token = response.token,
        )
    }
}
