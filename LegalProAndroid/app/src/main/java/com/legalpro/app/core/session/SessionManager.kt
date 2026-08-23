package com.legalpro.app.core.session

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Almacena y recupera el JWT del backend de forma segura en EncryptedSharedPreferences.
 * Se llama después del login exitoso en /api/auth/login.
 */
@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs by lazy {
        try {
            EncryptedSharedPreferences.create(
                context,
                "legalpro_secure_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            context.getSharedPreferences("legalpro_secure_prefs", Context.MODE_PRIVATE).edit().clear().apply()
            val file = java.io.File(context.filesDir.parent + "/shared_prefs/legalpro_secure_prefs.xml")
            if (file.exists()) file.delete()
            
            EncryptedSharedPreferences.create(
                context,
                "legalpro_secure_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }

    fun saveAuthToken(token: String) {
        prefs.edit().putString(KEY_AUTH_TOKEN, token).apply()
    }

    fun getAuthToken(): String? = prefs.getString(KEY_AUTH_TOKEN, null)

    fun clearSession() {
        prefs.edit().clear().apply()
    }

    fun isLoggedIn(): Boolean = getAuthToken() != null

    fun saveUserName(name: String) {
        prefs.edit().putString(KEY_USER_NAME, name).apply()
    }

    fun getUserName(): String? = prefs.getString(KEY_USER_NAME, null)

    // ─── Tenant / Org context ────────────────────────────────────────────────

    fun saveOrganizacionId(orgId: String) {
        prefs.edit().putString(KEY_ORG_ID, orgId).apply()
    }

    fun getOrganizacionId(): String? = prefs.getString(KEY_ORG_ID, null)

    fun saveOrganizacionNombre(nombre: String) {
        prefs.edit().putString(KEY_ORG_NOMBRE, nombre).apply()
    }

    fun getOrganizacionNombre(): String? = prefs.getString(KEY_ORG_NOMBRE, null)

    fun saveOrganizacionPlan(plan: String) {
        prefs.edit().putString(KEY_ORG_PLAN, plan).apply()
    }

    fun getOrganizacionPlan(): String? = prefs.getString(KEY_ORG_PLAN, null)

    fun saveRolOrg(rol: String) {
        prefs.edit().putString(KEY_ROL_ORG, rol).apply()
    }

    fun getRolOrg(): String? = prefs.getString(KEY_ROL_ORG, null)

    /** Guarda todos los campos tenant de una vez tras el login. */
    fun saveTenantContext(orgId: String?, orgNombre: String?, plan: String?, rolOrg: String?) {
        prefs.edit()
            .putString(KEY_ORG_ID, orgId)
            .putString(KEY_ORG_NOMBRE, orgNombre)
            .putString(KEY_ORG_PLAN, plan)
            .putString(KEY_ROL_ORG, rolOrg)
            .apply()
    }

    fun hasTenantContext(): Boolean = getOrganizacionId() != null

    // ─── Chat Sesión ─────────────────────────────────────────────────────────

    fun saveChatSesionId(sesionId: String) {
        prefs.edit().putString(KEY_CHAT_SESION_ID, sesionId).apply()
    }

    fun getChatSesionId(): String? = prefs.getString(KEY_CHAT_SESION_ID, null)

    companion object {
        private const val KEY_AUTH_TOKEN     = "auth_token"
        private const val KEY_USER_NAME      = "user_name"
        private const val KEY_ORG_ID         = "org_id"
        private const val KEY_ORG_NOMBRE     = "org_nombre"
        private const val KEY_ORG_PLAN       = "org_plan"
        private const val KEY_ROL_ORG        = "rol_org"
        private const val KEY_CHAT_SESION_ID = "chat_sesion_id"
    }
}
