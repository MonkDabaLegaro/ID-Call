package dev.idcall.core.data

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.idcall.core.model.LookupHistoryItem

object PrewarmSelector {
    fun select(items: List<LookupHistoryItem>, limit: Int = 10): List<String> {
        if (limit <= 0) return emptyList()
        return items
            .sortedByDescending { it.lastLookedUpEpochMs }
            .map { it.number }
            .distinct()
            .take(limit)
    }
}

class CachePrewarmWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val repository = LookupRepositoryFactory.create(applicationContext)
        val numbers = PrewarmSelector.select(repository.recentHistory(limit = 20), limit = 10)
        if (numbers.isEmpty()) return Result.success()

        var successes = 0
        numbers.forEach { number ->
            if (runCatching { repository.refresh(number) }.isSuccess) successes++
        }
        return if (successes > 0) Result.success() else Result.retry()
    }
}

object CachePrewarmScheduler {
    private const val UNIQUE_WORK_NAME = "id-call-cache-prewarm"

    fun enqueue(context: Context) {
        val request = OneTimeWorkRequestBuilder<CachePrewarmWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            UNIQUE_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }
}
