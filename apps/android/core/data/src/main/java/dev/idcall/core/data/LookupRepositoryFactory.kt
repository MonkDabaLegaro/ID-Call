package dev.idcall.core.data

import android.content.Context
import dev.idcall.core.database.LookupDatabase
import dev.idcall.core.network.LookupApiFactory

object LookupRepositoryFactory {
    const val DEFAULT_EMULATOR_API_BASE_URL = "http://10.0.2.2:3000/"

    fun create(
        context: Context,
        baseUrl: String = DEFAULT_EMULATOR_API_BASE_URL,
    ): LookupRepository {
        val database = LookupDatabase.get(context)
        val cache = RoomLookupCacheDataSource(database.lookupDao())
        val history = RoomLookupHistoryDataSource(database.historyDao())
        val remote = RetrofitLookupRemoteDataSource(LookupApiFactory.create(baseUrl))
        return DefaultLookupRepository(cache, remote, history = history)
    }
}
