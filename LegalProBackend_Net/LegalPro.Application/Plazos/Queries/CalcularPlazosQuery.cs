using FluentValidation;
using MediatR;

namespace LegalPro.Application.Plazos.Queries;

/// <summary>
/// Calcula plazos procesales según el CPC (Código Procesal Civil) y NCPP.
/// Lógica pura de fechas: no llama a Gemini, calcula en memoria con reglas del derecho peruano.
/// 
/// Reglas aplicadas:
///   - Art. 147 CPC: cómputo de plazos en días hábiles procesales.
///   - Art. 360 CPC: 15 días para apelar sentencia en proceso civil.
///   - Art. 414 NCPP: 5 días para apelar sentencia en juicio oral.
///   - Art. 205 CPC: 10 días para contestar demanda en proceso sumarísimo.
///   - Feriados judiciales: Semana Santa, Día del Juez, etc. (sin implementación completa — TODO).
/// </summary>
public record CalcularPlazosQuery(
    string TipoActo,          // "apelar_sentencia" | "contestar_demanda" | "interponer_recurso" | etc.
    string RamaDerecho,       // "penal" | "civil" | "laboral" | "familia" | "constitucional" | "administrativo"
    DateTime FechaNotificacion,  // cuándo fue notificado (fecha inicio del cómputo)
    string TipoProceso = "ordinario"  // "ordinario" | "sumarisimo" | "abreviado" | "ejecutivo"
) : IRequest<PlazosDto>;

public record PlazosDto(
    string TipoActo,
    string RamaDerecho,
    DateTime FechaNotificacion,
    int DiasCorridos,
    int DiasHabiles,
    DateTime FechaVencimiento,
    bool EsUrgente,                // true si vence en <= 3 días hábiles
    string FundamentoLegal,
    IReadOnlyList<HitoProcesal> Hitos,
    string Advertencia);

public record HitoProcesal(
    string Descripcion,
    DateTime Fecha,
    bool EsObligatorio);

public class CalcularPlazosQueryValidator : AbstractValidator<CalcularPlazosQuery>
{
    private static readonly string[] RamasValidas =
        { "penal", "civil", "laboral", "familia", "constitucional", "administrativo" };

    public CalcularPlazosQueryValidator()
    {
        RuleFor(x => x.TipoActo).NotEmpty().MaximumLength(100);
        RuleFor(x => x.RamaDerecho)
            .NotEmpty()
            .Must(v => RamasValidas.Contains(v.ToLower()))
            .WithMessage($"RamaDerecho debe ser: {string.Join(", ", RamasValidas)}");
        RuleFor(x => x.FechaNotificacion)
            .NotEmpty()
            .LessThanOrEqualTo(DateTime.UtcNow.AddDays(1))
            .WithMessage("La fecha de notificación no puede ser futura.");
    }
}

public class CalcularPlazosQueryHandler : IRequestHandler<CalcularPlazosQuery, PlazosDto>
{
    public Task<PlazosDto> Handle(CalcularPlazosQuery request, CancellationToken cancellationToken)
    {
        var (diasHabiles, fundamento) = ObtenerPlazo(request.TipoActo, request.RamaDerecho, request.TipoProceso);

        var vencimiento = CalcularFechaHabil(request.FechaNotificacion, diasHabiles);
        var diasCorridos = (int)(vencimiento - request.FechaNotificacion).TotalDays;
        var diasRestantes = (int)(vencimiento - DateTime.UtcNow.Date).TotalDays;

        var hitos = GenerarHitos(request.FechaNotificacion, vencimiento, diasHabiles);

        return Task.FromResult(new PlazosDto(
            TipoActo: request.TipoActo,
            RamaDerecho: request.RamaDerecho,
            FechaNotificacion: request.FechaNotificacion,
            DiasCorridos: diasCorridos,
            DiasHabiles: diasHabiles,
            FechaVencimiento: vencimiento,
            EsUrgente: diasRestantes <= 3,
            FundamentoLegal: fundamento,
            Hitos: hitos,
            Advertencia: diasRestantes <= 0
                ? "⚠️ PLAZO VENCIDO. Evalúe reposición por plazo o recurso de nulidad."
                : diasRestantes <= 3
                    ? $"⚠️ URGENTE: Vence en {diasRestantes} día(s) hábil(es)."
                    : $"Quedan {diasRestantes} día(s) calendarios hasta el vencimiento."));
    }

    // ── Tabla de plazos según código procesal peruano ──────────────────────────
    private static (int dias, string fundamento) ObtenerPlazo(
        string tipoActo, string rama, string tipoProceso)
    {
        var key = $"{rama.ToLower()}:{tipoActo.ToLower()}";

        return key switch
        {
            // Penal — NCPP
            "penal:apelar_sentencia" => (5, "NCPP art. 414: 5 días hábiles para apelar sentencia en juicio oral."),
            "penal:apelar_auto" => (3, "NCPP art. 414: 3 días hábiles para apelar auto."),
            "penal:interponer_recurso" => (5, "NCPP art. 432: 5 días hábiles para recurso de casación."),
            "penal:ofrecer_prueba" => (10, "NCPP art. 352: 10 días para ofrecer medios de prueba."),
            "penal:deducir_excepcion" => (10, "NCPP art. 7: 10 días hábiles para deducir excepciones."),
            "penal:formular_acusacion" => (15, "NCPP art. 349: 15 días para formular acusación."),

            // Civil — CPC
            "civil:apelar_sentencia" when tipoProceso == "sumarisimo"
                                               => (3, "CPC art. 556: 3 días para apelar en proceso sumarísimo."),
            "civil:apelar_sentencia" => (15, "CPC art. 373: 15 días hábiles para apelar sentencia."),
            "civil:apelar_auto" => (3, "CPC art. 376: 3 días hábiles para apelar auto."),
            "civil:contestar_demanda" when tipoProceso == "sumarisimo"
                                               => (5, "CPC art. 554: 5 días para contestar en proceso sumarísimo."),
            "civil:contestar_demanda" when tipoProceso == "abreviado"
                                               => (10, "CPC art. 491: 10 días para contestar en proceso abreviado."),
            "civil:contestar_demanda" => (30, "CPC art. 478: 30 días hábiles para contestar la demanda."),
            "civil:interponer_recurso" => (10, "CPC art. 396: 10 días para recurso de casación."),
            "civil:aclarar_sentencia" => (3, "CPC art. 406: 3 días para solicitar aclaración."),
            "civil:tachar_testigo" => (3, "CPC art. 229: 3 días para tachar testigo."),

            // Laboral — NLPT
            "laboral:apelar_sentencia" => (5, "NLPT art. 32: 5 días para apelar sentencia laboral."),
            "laboral:contestar_demanda" => (10, "NLPT art. 22: 10 días para contestar demanda laboral."),
            "laboral:interponer_recurso" => (10, "NLPT art. 34: 10 días para recurso de casación laboral."),

            // Familia — CPC aplicable
            "familia:apelar_sentencia" => (3, "CPC art. 556 supletorio: 3 días en proceso de familia."),
            "familia:contestar_demanda" => (5, "CPC art. 554 supletorio: 5 días en familia."),

            // Constitucional — Código Procesal Constitucional
            "constitucional:apelar_sentencia" => (2, "CPConst. art. 57: 2 días hábiles para apelar habeas corpus."),
            "constitucional:interponer_accion" => (5, "CPConst. art. 44: 5 años de prescripción para amparo (plazo de inicio)."),

            // Administrativo — LPAG
            "administrativo:interponer_recurso" => (15, "LPAG art. 218: 15 días hábiles para recursos administrativos."),
            "administrativo:apelar_resolucion" => (15, "LPAG art. 218: 15 días hábiles para apelación administrativa."),

            // Default: advertir que no está catalogado
            _ => (5, $"Plazo estimado para {tipoActo} en {rama}. Verifique en el código procesal correspondiente.")
        };
    }

    // ── Cómputo en días hábiles (CPC art. 147) ──────────────────────────────
    // Sábados, domingos y feriados nacionales son inhábiles.
    private static DateTime CalcularFechaHabil(DateTime fechaInicio, int diasHabiles)
    {
        var fecha = fechaInicio.Date.AddDays(1); // el cómputo inicia el día siguiente
        var diasContados = 0;

        while (diasContados < diasHabiles)
        {
            if (EsDiaHabil(fecha))
                diasContados++;
            if (diasContados < diasHabiles)
                fecha = fecha.AddDays(1);
        }

        // Si el vencimiento cae en inhábil, se corre al siguiente hábil (CPC art. 147)
        while (!EsDiaHabil(fecha))
            fecha = fecha.AddDays(1);

        return fecha;
    }

    private static bool EsDiaHabil(DateTime fecha)
    {
        // Sábados y domingos son inhábiles
        if (fecha.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            return false;

        // Feriados nacionales del Perú (fijos)
        var feriados = new HashSet<(int mes, int dia)>
        {
            (1, 1),    // Año Nuevo
            (5, 1),    // Día del Trabajo
            (6, 29),   // San Pedro y San Pablo
            (7, 28),   // Fiestas Patrias
            (7, 29),   // Fiestas Patrias
            (8, 30),   // Santa Rosa de Lima
            (10, 8),   // Batalla de Angamos
            (11, 1),   // Todos los Santos
            (12, 8),   // Inmaculada Concepción
            (12, 9),   // Batalla de Ayacucho
            (12, 25),  // Navidad
        };

        return !feriados.Contains((fecha.Month, fecha.Day));
    }

    private static List<HitoProcesal> GenerarHitos(DateTime inicio, DateTime vencimiento, int diasHabiles)
    {
        var hitos = new List<HitoProcesal>
        {
            new("Notificación recibida", inicio, true),
        };

        // Alerta a mitad del plazo si hay más de 4 días
        if (diasHabiles > 4)
        {
            var mitad = CalcularFechaHabil(inicio, diasHabiles / 2);
            hitos.Add(new("Revisión a mitad de plazo", mitad, false));
        }

        // Alerta 2 días antes del vencimiento
        if (diasHabiles > 2)
        {
            var alertaTemprana = CalcularFechaHabil(inicio, diasHabiles - 2);
            hitos.Add(new("⚠️ Alerta: 2 días hábiles restantes", alertaTemprana, false));
        }

        hitos.Add(new("🔴 VENCIMIENTO del plazo", vencimiento, true));

        return hitos;
    }
}
