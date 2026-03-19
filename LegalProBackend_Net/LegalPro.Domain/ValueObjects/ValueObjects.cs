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
