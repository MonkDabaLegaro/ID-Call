package dev.idcall.core.data

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class ReporterSessionManagerTest {
    @Test
    fun reusesExistingSessionWithoutRegistration() = runTest {
        val existing = ReporterSession("reporter-1", "token-1")
        val store = FakeStore(existing)
        val registrar = FakeRegistrar(ReporterSession("reporter-2", "token-2"))
        val manager = ReporterSessionManager(store, registrar)

        assertSame(existing, manager.session())
        assertEquals(0, registrar.calls)
    }

    @Test
    fun registersAndPersistsSessionWhenMissing() = runTest {
        val registered = ReporterSession("reporter-1", "token-1")
        val store = FakeStore(null)
        val registrar = FakeRegistrar(registered)
        val manager = ReporterSessionManager(store, registrar)

        assertSame(registered, manager.session())
        assertSame(registered, store.value)
        assertEquals(1, registrar.calls)
    }

    @Test
    fun invalidationClearsSessionAndNextAccessRegistersAgain() = runTest {
        val old = ReporterSession("reporter-old", "token-old")
        val replacement = ReporterSession("reporter-new", "token-new")
        val store = FakeStore(old)
        val registrar = FakeRegistrar(replacement)
        val manager = ReporterSessionManager(store, registrar)

        manager.invalidate()
        assertSame(replacement, manager.session())
        assertEquals(1, registrar.calls)
    }

    private class FakeStore(var value: ReporterSession?) : ReporterSessionStore {
        override fun get(): ReporterSession? = value
        override fun save(session: ReporterSession) { value = session }
        override fun clear() { value = null }
    }

    private class FakeRegistrar(private val session: ReporterSession) : ReporterRegistrar {
        var calls = 0
        override suspend fun registerReporter(): ReporterSession {
            calls += 1
            return session
        }
    }
}
