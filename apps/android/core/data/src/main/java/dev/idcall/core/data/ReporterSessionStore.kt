package dev.idcall.core.data

import android.content.Context

data class ReporterSession(
    val reporterId: String,
    val token: String,
)

interface ReporterSessionStore {
    fun get(): ReporterSession?
    fun save(session: ReporterSession)
    fun clear()
}

interface ReporterRegistrar {
    suspend fun registerReporter(): ReporterSession
}

class ReporterSessionManager(
    private val store: ReporterSessionStore,
    private val registrar: ReporterRegistrar,
) {
    suspend fun session(): ReporterSession {
        store.get()?.let { return it }
        return registrar.registerReporter().also(store::save)
    }

    fun invalidate() {
        store.clear()
    }
}

class SharedPreferencesReporterSessionStore(context: Context) : ReporterSessionStore {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override fun get(): ReporterSession? {
        val reporterId = preferences.getString(KEY_REPORTER_ID, null) ?: return null
        val token = preferences.getString(KEY_TOKEN, null) ?: return null
        return ReporterSession(reporterId, token)
    }

    override fun save(session: ReporterSession) {
        preferences.edit()
            .putString(KEY_REPORTER_ID, session.reporterId)
            .putString(KEY_TOKEN, session.token)
            .apply()
    }

    override fun clear() {
        preferences.edit()
            .remove(KEY_REPORTER_ID)
            .remove(KEY_TOKEN)
            .apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "id_call_reporter_session"
        const val KEY_REPORTER_ID = "reporter_id"
        const val KEY_TOKEN = "reporter_token"
    }
}
