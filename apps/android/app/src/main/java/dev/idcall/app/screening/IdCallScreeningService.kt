package dev.idcall.app.screening

import android.telecom.Call
import android.telecom.CallScreeningService

class IdCallScreeningService : CallScreeningService() {
    override fun onScreenCall(callDetails: Call.Details) {
        // Foundation behavior is deliberately non-blocking: identification enrichment
        // will be wired to a local cache before any network request is introduced here.
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
