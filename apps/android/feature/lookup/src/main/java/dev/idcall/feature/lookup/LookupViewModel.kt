package dev.idcall.feature.lookup

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import dev.idcall.core.data.LookupRepository
import dev.idcall.core.model.LookupHistoryItem
import dev.idcall.core.model.LookupResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface LookupUiState {
    data object Idle : LookupUiState
    data object Loading : LookupUiState
    data class Success(val result: LookupResult) : LookupUiState
    data class Error(val message: String) : LookupUiState
}

class LookupViewModel(
    private val repository: LookupRepository,
) : ViewModel() {
    private val _state = MutableStateFlow<LookupUiState>(LookupUiState.Idle)
    val state: StateFlow<LookupUiState> = _state.asStateFlow()

    private val _history = MutableStateFlow<List<LookupHistoryItem>>(emptyList())
    val history: StateFlow<List<LookupHistoryItem>> = _history.asStateFlow()

    private val _reportMessage = MutableStateFlow<String?>(null)
    val reportMessage: StateFlow<String?> = _reportMessage.asStateFlow()

    init {
        loadHistory()
    }

    fun lookup(number: String) {
        val input = number.trim()
        if (input.isEmpty()) {
            _state.value = LookupUiState.Error("Enter a phone number")
            return
        }

        viewModelScope.launch {
            _reportMessage.value = null
            _state.value = LookupUiState.Loading
            _state.value = runCatching { repository.lookup(input) }
                .fold(
                    onSuccess = {
                        loadHistory()
                        LookupUiState.Success(it)
                    },
                    onFailure = { LookupUiState.Error("Lookup failed. Check the number or connection and try again.") },
                )
        }
    }

    fun report(category: String) {
        val current = (_state.value as? LookupUiState.Success)?.result ?: return
        viewModelScope.launch {
            _reportMessage.value = "Submitting report…"
            runCatching { repository.report(current.record.number, category) }
                .onSuccess {
                    _state.value = LookupUiState.Success(it)
                    _reportMessage.value = "Report submitted. Reputation refreshed."
                    loadHistory()
                }
                .onFailure {
                    _reportMessage.value = "Report failed. Check the connection and try again."
                }
        }
    }

    private fun loadHistory() {
        viewModelScope.launch {
            _history.value = runCatching { repository.recentHistory(5) }.getOrDefault(emptyList())
        }
    }
}

class LookupViewModelFactory(
    private val repository: LookupRepository,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(LookupViewModel::class.java))
        return LookupViewModel(repository) as T
    }
}
