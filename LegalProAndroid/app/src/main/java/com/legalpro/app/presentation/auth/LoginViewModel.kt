// LegalProAndroid/app/src/main/java/com/legalpro/app/presentation/auth/LoginViewModel.kt
// Generado por @android (Sprint 3 - Android desde cero)
// ViewModel con Hilt + state flow

package com.legalpro.app.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.legalpro.app.data.remote.AuthRepository
import com.legalpro.app.data.local.TokenStorage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val isLoading: Boolean = false,
    val isAuthenticated: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenStorage: TokenStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(error = "Email y contrasena son requeridos") }
            return
        }
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            try {
                val result = authRepository.login(email, password)
                tokenStorage.saveTokens(result.accessToken, result.refreshToken)
                _uiState.update { it.copy(isLoading = false, isAuthenticated = true) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = mapError(e)) }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    private fun mapError(e: Exception): String = when {
        e.message?.contains("401") == true -> "Credenciales invalidas"
        e.message?.contains("network") == true -> "Error de red. Verifica tu conexion."
        else -> e.message ?: "Error desconocido"
    }
}
