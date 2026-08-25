package dev.idcall.core.data

import dev.idcall.core.model.LookupHistoryItem
import org.junit.Assert.assertEquals
import org.junit.Test

class PrewarmSelectorTest {
    @Test
    fun selectsNewestUniqueNumbersWithinLimit() {
        val items = listOf(
            LookupHistoryItem("+5691", "one", "unknown", 300L, 2),
            LookupHistoryItem("+5692", "two", "medium", 200L, 1),
            LookupHistoryItem("+5691", "one", "unknown", 100L, 1),
            LookupHistoryItem("+5693", "three", "low", 50L, 1),
        )

        assertEquals(listOf("+5691", "+5692"), PrewarmSelector.select(items, limit = 2))
    }

    @Test
    fun zeroLimitProducesNoWork() {
        val items = listOf(LookupHistoryItem("+5691", "one", "unknown", 300L, 1))
        assertEquals(emptyList<String>(), PrewarmSelector.select(items, limit = 0))
    }
}
