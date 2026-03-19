using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;
using LegalPro.Domain.Enums;
using LegalPro.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace LegalPro.Infrastructure.Services;

// ═══════════════════════════════════════════════════════
// SRP: SimulationService ONLY orchestrates.
// OCP: Uses Simulacion.Crear() factory method — adding new
//      creation rules modifies the entity, not this service.
// DIP: Depends on ISimulationAI, not concrete GeminiService.
// ═══════════════════════════════════════════════════════
public class SimulationService : ISimulationService
{
    private readonly IApplicationDbContext _context;
    private readonly ISimulationAI _simulationAI; // DIP: segregated interface (ISP)

    public SimulationService(IApplicationDbContext context, ISimulationAI simulationAI)
    {
        _context = context;
        _simulationAI = simulationAI;
    }

    public async Task<Simulacion> IniciarSimulacionAsync(int usuarioId, string ramaDerecho, string rolUsuario, string dificultadModificador)
    {
        // Finalizar simulaciones previas
        var previas = await _context.Simulaciones
            .Where(s => s.UsuarioId == usuarioId && !s.EstaFinalizada)
            .ToListAsync();

        foreach (var p in previas)
            p.Finalizar(); // OCP: uses domain method, not direct property mutation

        // Generar universo sintético via IA
        var promptCaso = $"Genera un caso complejo de derecho {ramaDerecho}. Rol de dificultad: {dificultadModificador}. Devuelve un JSON.";
        var contextoGenerado = await _simulationAI.GenerateSystemResponseAsync(promptCaso, "Creacion de Universo");

        // OCP: Factory method encapsula reglas de creación
        var rama = Enum.TryParse<TipoRamaProcesal>(ramaDerecho, true, out var parsedRama)
            ? parsedRama : TipoRamaProcesal.Penal;

        var nuevaSimulacion = Simulacion.Crear(usuarioId, rama, rolUsuario, dificultadModificador, contextoGenerado);

        // Domain method para agregar evento (no constructor directo)
        nuevaSimulacion.AgregarEvento("IA_Sistema", "Audiencia instalada. El abogado puede presentar su requerimiento.");

        _context.Simulaciones.Add(nuevaSimulacion);
        await _context.SaveChangesAsync(CancellationToken.None);

        return nuevaSimulacion;
    }

    public async Task<EventoSimulacion> ProcesarTurnoAsync(int simulacionId, string emisor, string mensaje)
    {
        var simulacion = await _context.Simulaciones
            .Include(s => s.Eventos)
            .FirstOrDefaultAsync(s => s.Id == simulacionId)
            ?? throw new NotFoundException(nameof(Simulacion), simulacionId); // DIP: domain exception

        // OCP: domain method validates business rules internally
        var eventoUsuario = simulacion.AgregarEvento(emisor, mensaje);

        // Generar respuesta IA
        var promptRAG = $"El usuario dijo: {mensaje}. Juega tu rol opuesto considerando la dificultad {simulacion.DificultadModificador}.";
        var respuestaIa = await _simulationAI.GenerateSystemResponseAsync(promptRAG, simulacion.ContextoSintetico);

        var eventoIA = simulacion.AgregarEvento("IA_Oponente", respuestaIa);

        await _context.SaveChangesAsync(CancellationToken.None);
        return eventoIA;
    }

    public async Task<Simulacion?> ObtenerSimulacionActivaObtenerAsync(int usuarioId)
    {
        return await _context.Simulaciones
            .Include(s => s.Eventos)
            .FirstOrDefaultAsync(s => s.UsuarioId == usuarioId && !s.EstaFinalizada);
    }
}
