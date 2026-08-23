using System.Text.RegularExpressions;
using LegalPro.Domain.Common;
using LegalPro.Domain.Exceptions;

namespace LegalPro.Domain.ValueObjects;

/// <summary>
/// Value Object for validated email addresses.
/// Enforces format at the domain level — impossible to create an invalid Email.
/// </summary>
public class Email : ValueObject
{
    public string Value { get; }

    private Email(string value)
    {
        Value = value;
    }

    public static Email Create(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new DomainException("El email no puede estar vacío.");

        email = email.Trim().ToLowerInvariant();

        if (!Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            throw new DomainException($"El formato del email '{email}' no es válido.");

        return new Email(email);
    }

    public override string ToString() => Value;

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Value;
    }

    // Implicit conversion for EF Core compatibility
    public static implicit operator string(Email email) => email.Value;
}

/// <summary>
/// Value Object for case file numbers (Número de Expediente).
/// Format: DDDDD-YYYY (5 digits, dash, 4-digit year)
/// </summary>
public class NumeroExpediente : ValueObject
{
    public string Value { get; }

    private NumeroExpediente(string value)
    {
        Value = value;
    }

    public static NumeroExpediente Create(string numero)
    {
        if (string.IsNullOrWhiteSpace(numero))
            throw new DomainException("El número de expediente no puede estar vacío.");

        numero = numero.Trim();

        if (!Regex.IsMatch(numero, @"^\d{4,5}-\d{4}$"))
            throw new DomainException($"El formato del expediente '{numero}' no es válido. Use: DDDDD-YYYY");

        return new NumeroExpediente(numero);
    }

    public override string ToString() => Value;

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Value;
    }

    public static implicit operator string(NumeroExpediente n) => n.Value;
}

/// <summary>
/// Value Object para montos en Soles Peruanos (PEN).
/// Garantiza que no sea un monto negativo.
/// </summary>
public class MontoSoles : ValueObject
{
    public decimal Value { get; }

    private MontoSoles(decimal value)
    {
        Value = value;
    }

    public static MontoSoles Create(decimal value)
    {
        if (value < 0)
            throw new DomainException("El monto en soles no puede ser negativo.");

        return new MontoSoles(value);
    }

    public override string ToString() => string.Format(System.Globalization.CultureInfo.InvariantCulture, "S/. {0:N2}", Value);

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Value;
    }

    public static implicit operator decimal(MontoSoles m) => m.Value;
}

/// <summary>
/// Value Object para plazos procesales.
/// Controla la cantidad de días útiles o calendario de un plazo.
/// </summary>
public class PlazoProcesal : ValueObject
{
    public int Dias { get; }
    public bool EsDiasHabiles { get; }

    private PlazoProcesal(int dias, bool esDiasHabiles)
    {
        Dias = dias;
        EsDiasHabiles = esDiasHabiles;
    }

    public static PlazoProcesal Create(int dias, bool esDiasHabiles = true)
    {
        if (dias < 0)
            throw new DomainException("El plazo procesal no puede ser negativo.");

        return new PlazoProcesal(dias, esDiasHabiles);
    }

    public DateTime CalcularFechaVencimiento(DateTime fechaInicio)
    {
        if (EsDiasHabiles)
        {
            DateTime fecha = fechaInicio;
            int diasRestantes = Dias;
            while (diasRestantes > 0)
            {
                fecha = fecha.AddDays(1);
                if (fecha.DayOfWeek != DayOfWeek.Saturday && fecha.DayOfWeek != DayOfWeek.Sunday)
                {
                    diasRestantes--;
                }
            }
            return fecha;
        }
        else
        {
            return fechaInicio.AddDays(Dias);
        }
    }

    public override string ToString() => $"{Dias} días {(EsDiasHabiles ? "hábiles" : "calendario")}";

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Dias;
        yield return EsDiasHabiles;
    }
}

