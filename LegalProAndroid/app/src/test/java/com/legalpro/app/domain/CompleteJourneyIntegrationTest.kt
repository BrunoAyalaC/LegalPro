package com.legalpro.app.domain

import org.junit.Assert.*
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de dominio usados en los tests de integración
// (lógica pura Kotlin sin Android Framework)
// ─────────────────────────────────────────────────────────────────────────────

/** Roles válidos en LegalPro Perú */
private val ROLES_VALIDOS = setOf("ABOGADO", "FISCAL", "JUEZ", "CONTADOR")

/** Materias legales válidas en el contexto peruano */
private val MATERIAS_VALIDAS = setOf("PENAL", "CIVIL", "LABORAL", "CONSTITUCIONAL", "FAMILIAR", "ADMINISTRATIVO")

/** Formato de fecha peruano (DD/MM/YYYY) */
private val FORMATO_FECHA_PERUANA = SimpleDateFormat("dd/MM/yyyy", Locale("es", "PE"))

// ─── Funciones de validación de dominio ──────────────────────────────────────

/** Valida un rol de usuario */
private fun esRolValido(rol: String): Boolean = ROLES_VALIDOS.contains(rol.uppercase())

/** Valida un token JWT (no vacío y con estructura básica de 3 partes) */
private fun esTokenJwtValido(token: String): Boolean {
    if (token.isBlank()) return false
    val partes = token.split(".")
    return partes.size == 3 && partes.all { it.isNotEmpty() }
}

/** Valida un email con reglas básicas */
private fun esEmailValido(email: String): Boolean {
    if (email.isBlank()) return false
    val partes = email.split("@")
    if (partes.size != 2) return false
    val dominio = partes[1]
    return dominio.contains(".") && dominio.length > 2
}

/** Valida una contraseña con mínimo 8 caracteres */
private fun esPasswordValida(password: String): Boolean = password.length >= 8

/** Valida que el número de expediente no esté vacío */
private fun esNumeroExpedienteValido(numero: String): Boolean = numero.isNotBlank()

/** Valida una materia legal */
private fun esMateriaValida(materia: String): Boolean = MATERIAS_VALIDAS.contains(materia.uppercase())

/** Analiza si una fecha de prescripción es futura o pasada */
private fun evaluarFechaPrescripcion(fecha: Date): String {
    val ahora = Calendar.getInstance().time
    return if (fecha.after(ahora)) "VIGENTE" else "PRESCRITA"
}

/** Parsea una fecha en formato peruano DD/MM/YYYY */
private fun parsearFechaPeruana(fechaStr: String): Date {
    return FORMATO_FECHA_PERUANA.parse(fechaStr)
        ?: throw IllegalArgumentException("Formato de fecha inválido: $fechaStr")
}

/** Valida si una descripción de caso es procesable */
private fun esDescripcionCasoProcesable(descripcion: String): Boolean = descripcion.isNotBlank()

/**
 * Verifica pertenencia multi-tenant:
 * Un usuario sólo puede ver expedientes de su propia organización.
 */
private fun usuarioPuedeVerExpediente(usuarioOrgId: String, expedienteOrgId: String): Boolean {
    return usuarioOrgId == expedienteOrgId
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY TESTS DE INTEGRACIÓN — Capas de dominio (puro Kotlin / JVM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JOURNEY TESTS DE INTEGRACIÓN — Domain Layer
 * Tests puros de lógica de dominio sin dependencias de Android.
 * Cubre roles, autenticación, expedientes, materias, fechas y multi-tenant.
 */
class CompleteJourneyIntegrationTest {

    // ─── Journey 1: Validación de roles válidos ───────────────────

    @Test
    fun `journey_rol_ABOGADO_es_valido`() {
        assertTrue("ABOGADO debe ser un rol válido", esRolValido("ABOGADO"))
    }

    @Test
    fun `journey_rol_FISCAL_es_valido`() {
        assertTrue("FISCAL debe ser un rol válido", esRolValido("FISCAL"))
    }

    @Test
    fun `journey_rol_JUEZ_es_valido`() {
        assertTrue("JUEZ debe ser un rol válido", esRolValido("JUEZ"))
    }

    @Test
    fun `journey_rol_CONTADOR_es_valido`() {
        assertTrue("CONTADOR debe ser un rol válido", esRolValido("CONTADOR"))
    }

    // ─── Journey 2: Roles inválidos son rechazados ────────────────

    @Test
    fun `journey_rol_invalido_ADMIN_no_esta_permitido`() {
        assertFalse("ADMIN no es un rol del sistema", esRolValido("ADMIN"))
    }

    @Test
    fun `journey_rol_invalido_SUPERUSER_no_esta_permitido`() {
        assertFalse("SUPERUSER no es un rol del sistema", esRolValido("SUPERUSER"))
    }

    @Test
    fun `journey_rol_vacio_no_es_valido`() {
        assertFalse("Rol vacío no debe ser aceptado", esRolValido(""))
    }

    @Test
    fun `journey_rol_con_minusculas_es_aceptado_por_normalizacion`() {
        // El sistema normaliza a uppercase antes de validar
        assertTrue("El sistema acepta minúsculas normalizando a uppercase", esRolValido("abogado"))
        assertTrue(esRolValido("fiscal"))
        assertTrue(esRolValido("juez"))
        assertTrue(esRolValido("contador"))
    }

    // ─── Journey 3: Token JWT vacío es rechazado ──────────────────

    @Test
    fun `journey_token_jwt_vacio_no_es_valido`() {
        assertFalse("Token vacío debe ser rechazado", esTokenJwtValido(""))
    }

    @Test
    fun `journey_token_jwt_sin_estructura_basica_no_es_valido`() {
        assertFalse("Token sin puntos no es JWT válido", esTokenJwtValido("soloUnString"))
        assertFalse("Token con un solo punto no es válido", esTokenJwtValido("header.payload"))
    }

    @Test
    fun `journey_token_jwt_con_tres_partes_es_valido_estructuralmente`() {
        // Estructura JWT real: header.payload.signature
        val tokenFake = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        assertTrue("JWT con 3 partes es estructuralmente válido", esTokenJwtValido(tokenFake))
    }

    @Test
    fun `journey_token_jwt_con_espacios_en_blanco_no_es_valido`() {
        assertFalse("Token con solo espacios es inválido", esTokenJwtValido("   "))
    }

    // ─── Journey 4: Email sin @ es inválido ───────────────────────

    @Test
    fun `journey_email_sin_arroba_no_es_valido`() {
        assertFalse("Email sin @ no es válido", esEmailValido("abogadolegalpro.pe"))
        assertFalse(esEmailValido("sinArrobaEnElEmail"))
    }

    @Test
    fun `journey_email_valido_pasa_validacion`() {
        assertTrue(esEmailValido("abogado@legalpro.pe"))
        assertTrue(esEmailValido("fiscal.torres@mp.gob.pe"))
        assertTrue(esEmailValido("juez+notif@pj.gob.pe"))
    }

    // ─── Journey 5: Password con menos de 8 chars → inválida ──────

    @Test
    fun `journey_password_con_menos_de_8_chars_no_es_valida`() {
        assertFalse("7 caracteres no alcanzan el mínimo", esPasswordValida("abc1234"))
        assertFalse("6 caracteres no alcanzan el mínimo", esPasswordValida("abc123"))
        assertFalse("Contraseña vacía no es válida", esPasswordValida(""))
    }

    @Test
    fun `journey_password_con_exactamente_8_chars_es_valida`() {
        assertTrue("Exactamente 8 caracteres es el mínimo válido", esPasswordValida("12345678"))
        assertTrue(esPasswordValida("LegalPro"))
    }

    @Test
    fun `journey_password_con_mas_de_8_chars_es_valida`() {
        assertTrue(esPasswordValida("LegalPro2026!"))
        assertTrue(esPasswordValida("FiscalT0rres@mp.gob"))
    }

    // ─── Journey 6: Email con @ pero sin dominio → inválido ───────

    @Test
    fun `journey_email_con_arroba_pero_sin_punto_en_dominio_no_es_valido`() {
        assertFalse("@sindominio no tiene punto en el dominio", esEmailValido("usuario@sindominio"))
    }

    @Test
    fun `journey_email_que_comienza_con_arroba_no_es_valido`() {
        assertFalse("Email comenzando con @ no es válido", esEmailValido("@sinusuario.com"))
    }

    @Test
    fun `journey_email_con_dominio_muy_corto_no_es_valido`() {
        // El dominio debe tener más de 2 caracteres después de @
        assertFalse("Dominio extremadamente corto no es válido", esEmailValido("a@b.c"))
    }

    // ─── Journey 7: Caso con número expediente vacío → inválido ───

    @Test
    fun `journey_numero_expediente_vacio_es_invalido`() {
        assertFalse("Número de expediente vacío no es válido", esNumeroExpedienteValido(""))
        assertFalse("Solo espacios no es válido", esNumeroExpedienteValido("   "))
    }

    @Test
    fun `journey_numero_expediente_con_formato_peru_es_valido`() {
        // Formato peruano: 00123-2024-0-1801-JR-PE-01
        assertTrue(esNumeroExpedienteValido("00123-2024-0-1801-JR-PE-01"))
        assertTrue(esNumeroExpedienteValido("EXP-LIMA-2024-00456"))
        assertTrue(esNumeroExpedienteValido("123456"))
    }

    // ─── Journey 8: Materia legal válida ──────────────────────────

    @Test
    fun `journey_materia_PENAL_es_valida`() {
        assertTrue(esMateriaValida("PENAL"))
    }

    @Test
    fun `journey_materia_CIVIL_es_valida`() {
        assertTrue(esMateriaValida("CIVIL"))
    }

    @Test
    fun `journey_materia_LABORAL_es_valida`() {
        assertTrue(esMateriaValida("LABORAL"))
    }

    @Test
    fun `journey_materia_CONSTITUCIONAL_es_valida`() {
        assertTrue(esMateriaValida("CONSTITUCIONAL"))
    }

    @Test
    fun `journey_materia_FAMILIAR_es_valida`() {
        assertTrue(esMateriaValida("FAMILIAR"))
    }

    @Test
    fun `journey_materia_ADMINISTRATIVO_es_valida`() {
        assertTrue(esMateriaValida("ADMINISTRATIVO"))
    }

    @Test
    fun `journey_todas_las_materias_validas_son_exactamente_6`() {
        assertEquals("Debe haber exactamente 6 materias válidas", 6, MATERIAS_VALIDAS.size)
    }

    // ─── Journey 9: Materia inválida → rechazada ──────────────────

    @Test
    fun `journey_materia_invalida_MERCANTIL_no_existe_en_sistema`() {
        assertFalse("MERCANTIL no es materia del sistema peruano", esMateriaValida("MERCANTIL"))
    }

    @Test
    fun `journey_materia_invalida_COMERCIAL_no_existe`() {
        assertFalse(esMateriaValida("COMERCIAL"))
    }

    @Test
    fun `journey_materia_vacia_no_es_valida`() {
        assertFalse("Materia vacía no debe aceptarse", esMateriaValida(""))
    }

    @Test
    fun `journey_materia_en_minusculas_es_aceptada_por_normalizacion`() {
        assertTrue("La normalización debe aceptar minúsculas", esMateriaValida("penal"))
        assertTrue(esMateriaValida("civil"))
        assertTrue(esMateriaValida("laboral"))
    }

    // ─── Journey 10: Fecha de prescripción futura → válida ────────

    @Test
    fun `journey_fecha_prescripcion_futura_es_vigente`() {
        val futuro = Calendar.getInstance().apply { add(Calendar.YEAR, 2) }.time
        val resultado = evaluarFechaPrescripcion(futuro)
        assertEquals("Una fecha futura debe ser VIGENTE", "VIGENTE", resultado)
    }

    @Test
    fun `journey_fecha_prescripcion_lejana_futura_es_vigente`() {
        val futuroLejano = Calendar.getInstance().apply { add(Calendar.YEAR, 10) }.time
        assertEquals("VIGENTE", evaluarFechaPrescripcion(futuroLejano))
    }

    // ─── Journey 11: Fecha de prescripción pasada → advertencia ───

    @Test
    fun `journey_fecha_prescripcion_pasada_es_prescrita`() {
        val pasado = Calendar.getInstance().apply { add(Calendar.YEAR, -3) }.time
        val resultado = evaluarFechaPrescripcion(pasado)
        assertEquals("Una fecha pasada debe ser PRESCRITA", "PRESCRITA", resultado)
    }

    @Test
    fun `journey_fecha_prescripcion_ayer_es_prescrita`() {
        val ayer = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }.time
        assertEquals("PRESCRITA", evaluarFechaPrescripcion(ayer))
    }

    // ─── Journey 12: Texto legal largo es procesable ──────────────

    @Test
    fun `journey_texto_legal_con_mas_de_10000_chars_es_procesable`() {
        // Simula un documento legal extenso (demanda, expediente, etc.)
        val textoLargo = "Señor Juez, " + "a".repeat(10_000)
        assertTrue("Texto largo debe ser procesable", textoLargo.length > 10_000)
        assertTrue("Descripción larga no debe ser rechazada", esDescripcionCasoProcesable(textoLargo))
    }

    @Test
    fun `journey_texto_legal_de_50000_chars_es_procesable`() {
        val textoMuyLargo = "Expediente judicial completo: " + "x".repeat(50_000)
        assertTrue("Texto de 50K+ chars debe seguir siendo procesable", esDescripcionCasoProcesable(textoMuyLargo))
    }

    // ─── Journey 13: Análisis de caso: descripción obligatoria ────

    @Test
    fun `journey_descripcion_vacia_no_es_procesable`() {
        assertFalse("Descripción vacía no puede ser procesada", esDescripcionCasoProcesable(""))
        assertFalse("Solo espacios no es válido", esDescripcionCasoProcesable("   "))
    }

    @Test
    fun `journey_descripcion_minima_de_un_caracter_es_procesable`() {
        // Validación mínima: al menos 1 carácter no-espacio
        assertTrue(esDescripcionCasoProcesable("a"))
        assertTrue(esDescripcionCasoProcesable("Caso de robo"))
    }

    // ─── Journey 14: Multi-tenant — segregación de datos ──────────

    @Test
    fun `journey_usuario_de_org_A_puede_ver_expedientes_de_org_A`() {
        val orgId = "org-estudio-garcia-lima"
        assertTrue(
            "Usuario de la org A debe ver sus propios expedientes",
            usuarioPuedeVerExpediente(usuarioOrgId = orgId, expedienteOrgId = orgId)
        )
    }

    @Test
    fun `journey_usuario_de_org_A_no_puede_ver_expedientes_de_org_B`() {
        assertFalse(
            "Usuario de org A NO debe acceder a expedientes de org B (multi-tenant)",
            usuarioPuedeVerExpediente(
                usuarioOrgId = "org-estudio-garcia-lima",
                expedienteOrgId = "org-bufete-torres-arequipa"
            )
        )
    }

    @Test
    fun `journey_usuario_con_org_vacia_no_puede_ver_ningun_expediente`() {
        assertFalse(
            "Org vacía no debe tener acceso a ningún expediente",
            usuarioPuedeVerExpediente(
                usuarioOrgId = "",
                expedienteOrgId = "org-bufete-torres-arequipa"
            )
        )
    }

    @Test
    fun `journey_multiples_usuarios_de_misma_org_comparten_expedientes`() {
        val orgCompartida = "org-ministerio-publico-lima"
        // Fiscal 1 y Fiscal 2 de la misma fiscalía
        assertTrue(usuarioPuedeVerExpediente(orgCompartida, orgCompartida))
    }

    // ─── Journey 15: Conversión de formato de fecha peruano ───────

    @Test
    fun `journey_parsear_fecha_peruana_DD_MM_YYYY_correctamente`() {
        val fecha = parsearFechaPeruana("15/03/2024")
        assertNotNull("La fecha parseada no debe ser null", fecha)

        val cal = Calendar.getInstance().apply { time = fecha }
        assertEquals("Día debe ser 15", 15, cal.get(Calendar.DAY_OF_MONTH))
        assertEquals("Mes debe ser marzo (índice 2)", 2, cal.get(Calendar.MONTH))
        assertEquals("Año debe ser 2024", 2024, cal.get(Calendar.YEAR))
    }

    @Test
    fun `journey_parsear_fecha_inicio_de_anio_peruana`() {
        val fecha = parsearFechaPeruana("01/01/2025")
        val cal = Calendar.getInstance().apply { time = fecha }

        assertEquals(1, cal.get(Calendar.DAY_OF_MONTH))
        assertEquals(0, cal.get(Calendar.MONTH)) // Enero = índice 0
        assertEquals(2025, cal.get(Calendar.YEAR))
    }

    @Test
    fun `journey_parsear_fecha_fin_de_anio_peruana`() {
        val fecha = parsearFechaPeruana("31/12/2023")
        val cal = Calendar.getInstance().apply { time = fecha }

        assertEquals(31, cal.get(Calendar.DAY_OF_MONTH))
        assertEquals(11, cal.get(Calendar.MONTH)) // Diciembre = índice 11
        assertEquals(2023, cal.get(Calendar.YEAR))
    }

    @Test
    fun `journey_formato_fecha_peruana_genera_string_correcto`() {
        // Verificar que el formato produce DD/MM/YYYY
        val cal = Calendar.getInstance().apply {
            set(2024, 5, 15) // 15 de junio de 2024 (mes es base 0)
        }
        val fechaStr = FORMATO_FECHA_PERUANA.format(cal.time)
        assertEquals("Formato debe ser DD/MM/YYYY", "15/06/2024", fechaStr)
    }

    @Test(expected = Exception::class)
    fun `journey_formato_de_fecha_incorrecto_lanza_excepcion`() {
        // Formato americano MM/DD/YYYY → debe rechazarse o producir fecha incorrecta
        // Configuramos strict parsing para asegurar que falle
        FORMATO_FECHA_PERUANA.isLenient = false
        parsearFechaPeruana("13/32/2024") // Día 32 no existe → excepción
    }
}
