package dev.idcall.platform.screening

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

object IncomingCallNotifier {
    private const val CHANNEL_ID = "caller_identification"

    fun show(context: Context, number: String, decision: ScreeningDecision) {
        val label = decision.displayLabel ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Caller identification",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Local ID-Call identification for incoming calls"
            }
        )

        val reputation = decision.reputationLevel?.let { "Reputation: $it · " }.orEmpty()
        val notification = Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle(label)
            .setContentText("$reputation$number")
            .setCategory(Notification.CATEGORY_CALL)
            .setAutoCancel(true)
            .build()

        manager.notify(number.hashCode(), notification)
    }
}
