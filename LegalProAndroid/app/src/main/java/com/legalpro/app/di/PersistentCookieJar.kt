package com.legalpro.app.di

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class PersistentCookieJar(context: Context) : CookieJar {
    private val sharedPreferences = context.getSharedPreferences("legalpro_cookies", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val cookiesMap = mutableMapOf<String, List<Cookie>>()

    init {
        val allEntries = sharedPreferences.all
        for ((key, value) in allEntries) {
            if (value is String) {
                try {
                    val listType = object : TypeToken<List<SerializableCookie>>() {}.type
                    val serializableList: List<SerializableCookie> = gson.fromJson(value, listType)
                    val cookies = serializableList.mapNotNull { it.toCookie() }
                    cookiesMap[key] = cookies
                } catch (e: Exception) {
                    // Ignorar errores de parseo
                }
            }
        }
    }

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val host = url.host
        val existing = cookiesMap[host] ?: emptyList()
        // Combinar y eliminar duplicados manteniendo las cookies más recientes por su nombre
        val merged = (existing + cookies).associateBy { it.name }.values.toList()
        cookiesMap[host] = merged

        val serializableList = merged.map { SerializableCookie(it) }
        val json = gson.toJson(serializableList)
        sharedPreferences.edit().putString(host, json).apply()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val host = url.host
        val cookies = cookiesMap[host] ?: emptyList()
        val currentTime = System.currentTimeMillis()
        val validCookies = cookies.filter { it.expiresAt > currentTime }
        
        if (validCookies.size != cookies.size) {
            cookiesMap[host] = validCookies
            val serializableList = validCookies.map { SerializableCookie(it) }
            val json = gson.toJson(serializableList)
            sharedPreferences.edit().putString(host, json).apply()
        }
        return validCookies
    }
}

data class SerializableCookie(
    val name: String,
    val value: String,
    val expiresAt: Long,
    val domain: String,
    val path: String,
    val secure: Boolean,
    val httpOnly: Boolean,
    val hostOnly: Boolean
) {
    constructor(cookie: Cookie) : this(
        name = cookie.name,
        value = cookie.value,
        expiresAt = cookie.expiresAt,
        domain = cookie.domain,
        path = cookie.path,
        secure = cookie.secure,
        httpOnly = cookie.httpOnly,
        hostOnly = cookie.hostOnly
    )

    fun toCookie(): Cookie? {
        val builder = Cookie.Builder()
            .name(name)
            .value(value)
            .expiresAt(expiresAt)
            .path(path)
        if (hostOnly) {
            builder.hostOnlyDomain(domain)
        } else {
            builder.domain(domain)
        }
        if (secure) builder.secure()
        if (httpOnly) builder.httpOnly()
        return try {
            builder.build()
        } catch (e: Exception) {
            null
        }
    }
}
