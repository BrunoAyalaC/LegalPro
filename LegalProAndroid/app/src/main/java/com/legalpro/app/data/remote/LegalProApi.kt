package com.legalpro.app.data.remote

import com.legalpro.app.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.*

interface LegalProApi {

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<RegisterResponse>

    @POST("api/analista/analizar")
    suspend fun analizarExpediente(@Body request: AnalizarExpedienteRequest): Response<AnalizarExpedienteResponse>

    @POST("api/predictor/predecir")
    suspend fun predecirResultado(@Body request: PredecirResultadoRequest): Response<PredecirResultadoResponse>

    @POST("api/redactor/generar")
    suspend fun generarEscrito(@Body request: GenerarEscritoRequest): Response<GenerarEscritoResponse>

    @POST("api/jurisprudencia/buscar")
    suspend fun buscarJurisprudencia(@Body request: BusquedaJurisprudenciaRequest): Response<BusquedaJurisprudenciaResponse>

    @POST("api/chat/enviar")
    suspend fun enviarMensajeChat(@Body request: ChatRequest): Response<ChatResponse>

    @POST("api/simulacion/iniciar")
    suspend fun iniciarSimulacion(@Body request: IniciarSimulacionRequest): Response<IniciarSimulacionResponse>

    @POST("api/simulacion/turno")
    suspend fun procesarTurno(@Body request: TurnoSimulacionRequest): Response<ProcesarTurnoResponse>

    @GET("api/simulacion/activa")
    suspend fun obtenerSimulacionActiva(): Response<SimulacionActivaDto>

    @POST("api/organizaciones")
    suspend fun crearOrganizacion(@Body request: CrearOrganizacionRequest): Response<CrearOrganizacionResponse>

    @GET("api/organizaciones/me")
    suspend fun getOrganizacionActual(): Response<OrganizacionDto>

    @GET("api/organizaciones/me/miembros")
    suspend fun getMiembros(): Response<MiembrosResponse>

    @POST("api/organizaciones/invitar")
    suspend fun invitarMiembro(@Body request: InvitarMiembroRequest): Response<InvitarMiembroResponse>

    @POST("api/organizaciones/aceptar-invitacion")
    suspend fun aceptarInvitacion(@Body request: AceptarInvitacionRequest): Response<AceptarInvitacionResponse>

    @DELETE("api/organizaciones/me/miembros/{usuarioId}")
    suspend fun removerMiembro(@Path("usuarioId") usuarioId: Int): Response<Unit>

    @POST("api/alegato/generar")
    suspend fun generarAlegato(@Body request: AlegatosRequest): Response<AlegatosResponse>

    @POST("api/interrogatorio/generar")
    suspend fun generarInterrogatorio(@Body request: InterrogatorioRequest): Response<InterrogatorioResponse>

    @POST("api/objeciones/sugerir")
    suspend fun sugerirObjecion(@Body request: ObjecionRequest): Response<ObjecionResponse>

    @POST("api/resumir-caso")
    suspend fun resumirCaso(@Body request: ResumenCasoRequest): Response<ResumenCasoResponse>

    @POST("api/fiscal/requerimiento")
    suspend fun generarRequerimiento(@Body request: FiscalRequest): Response<FiscalResponse>

    @POST("api/juez/resolucion")
    suspend fun generarResolucion(@Body request: JuezRequest): Response<JuezResponse>

    @POST("api/juez/precedentes/comparar")
    suspend fun compararPrecedentes(@Body request: PrecedentesRequest): Response<PrecedentesResponse>

    @POST("api/contador/liquidacion-laboral")
    suspend fun calcularLiquidacion(@Body request: LiquidacionRequest): Response<LiquidacionResponse>

    @POST("api/contador/informe-pericial")
    suspend fun generarInformePericial(@Body request: InformePericialRequest): Response<InformePericialResponse>

    @GET("api/chat/historial")
    suspend fun getHistorialChat(
        @Query("sesionId") sesionId: String,
        @Query("limit") limit: Int
    ): Response<HistorialChatResponse>

    @GET("api/chat/sesiones")
    suspend fun getSesionesChat(
        @Query("limit") limit: Int
    ): Response<SesionesChatResponse>

    // --- Panel de expertos (Fase 7) ---
    @POST("api/ai/panel-expertos")
    suspend fun analizarPanelExpertos(
        @Body request: PanelExpertosRequest
    ): Response<PanelExpertosResponse>
}
