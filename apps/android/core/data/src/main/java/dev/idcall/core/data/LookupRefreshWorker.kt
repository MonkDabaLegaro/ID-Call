package dev.idcall.core.data

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.Constraints

class LookupRefreshWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val number = inputData.getString(KEY_NUMBER) ?: return Result.failure()
        return runCatching {
            LookupRepositoryFactory.create(applicationContext).refresh(number)
            Result.success()
        }.getOrElse { Result.retry() }
    }

    companion object {
        const val KEY_NUMBER = "phone_number"
    }
}

object LookupRefreshScheduler {
    fun enqueue(context: Context, number: String) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = OneTimeWorkRequestBuilder<LookupRefreshWorker>()
            .setConstraints(constraints)
            .setInputData(Data.Builder().putString(LookupRefreshWorker.KEY_NUMBER, number).build())
            .build()
        WorkManager.getInstance(context).enqueue(request)
    }
}
