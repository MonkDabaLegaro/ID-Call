package dev.idcall.platform.screening

import android.telecom.Call
import android.telecom.CallScreeningService
import dev.idcall.core.data.LookupRefreshScheduler
import dev.idcall.core.data.RoomLookupCacheDataSource
import dev.idcall.core.database.LookupDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

private const val LOCAL_LOOKUP_TIMEOUT_MS = 350L

class IdCallScreeningService : CallScreeningService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onScreenCall(callDetails: Call.Details) {
        val number = callDetails.handle?.schemeSpecificPart
        if (number.isNullOrBlank()) {
            respondAllowed(callDetails)
            return
        }

        scope.launch {
            val cache = RoomLookupCacheDataSource(LookupDatabase.get(applicationContext).lookupDao())
            val resolver = ScreeningLookupResolver(cache)
            val decision = withTimeoutOrNull(LOCAL_LOOKUP_TIMEOUT_MS) {
                resolver.resolve(number, System.currentTimeMillis())
            } ?: ScreeningDecision(displayLabel = null, shouldRefresh = true)

            respondAllowed(callDetails)

            if (decision.displayLabel != null) {
                IncomingCallNotifier.show(applicationContext, number, decision)
            }
            if (decision.shouldRefresh) {
                LookupRefreshScheduler.enqueue(applicationContext, number)
            }
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun respondAllowed(callDetails: Call.Details) {
        val response = CallResponse.Builder()
            .setDisallowCall(false)
            .setRejectCall(false)
            .setSilenceCall(false)
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build()
        respondToCall(callDetails, response)
    }
}
