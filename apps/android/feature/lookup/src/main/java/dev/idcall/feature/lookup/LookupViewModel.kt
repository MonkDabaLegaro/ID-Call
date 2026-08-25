package dev.idcall.feature.lookup

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import dev.idcall.core.data.LookupRepository
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

    fun lookup(number: String) {
        val input = number.trim()
        if (input.isEmpty()) {
            _state.value = LookupUiState.Error("Enter a phone number")
            return
        }

        viewModelScope.launch {
            _state.value = LookupUiState.Loading
            _state.value = runCatching { repository.lookup(input) }
                .fold(
                    onSuccess = { LookupUiState.Success(it) },
                    onFailure = { LookupUiState.Error("Lookup failed. Check the number or connection and try again.") },
                )
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
