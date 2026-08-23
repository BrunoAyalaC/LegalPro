using System.Security.Cryptography;
using System.Text;
using LegalPro.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace LegalPro.Infrastructure.Services;

/// <summary>
/// Implementación de cifrado AES-256-GCM para E2EE del Owner Dashboard.
/// 
/// Especificaciones:
///   - Algoritmo: AES-256-GCM (autenticado)
///   - Clave: 32 bytes (256 bits)
///   - IV (nonce): 12 bytes (96 bits) — aleatorio por operación
///   - Tag: 16 bytes (128 bits) — autenticación GCM
///   - Salt: 16 bytes — para derivación de clave (PBKDF2)
///   
/// Seguridad:
///   - IV único por cifrado (nunca reutilizar IV con la misma clave)
///   - Tag verifica integridad + autenticidad
///   - Falla rápido si los parámetros son inválidos
/// </summary>
public class EncryptionService : IEncryptionService
{
    private readonly ILogger<EncryptionService> _logger;

    public EncryptionService(ILogger<EncryptionService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Cifra texto plano con AES-256-GCM.
    /// Genera IV aleatorio de 12 bytes y salt de 16 bytes automáticamente.
    /// </summary>
    public EncryptionResult Encrypt(string plainText, byte[] key)
    {
        ArgumentNullException.ThrowIfNull(plainText);
        ArgumentNullException.ThrowIfNull(key);

        if (key.Length != 32)
            throw new ArgumentException($"La clave debe tener 32 bytes (256 bits). Recibidos: {key.Length} bytes.", nameof(key));

        var iv = RandomNumberGenerator.GetBytes(12);   // 12 bytes para GCM
        var salt = RandomNumberGenerator.GetBytes(16); // 16 bytes para derivación

        var plainBytes = Encoding.UTF8.GetBytes(plainText);
        var cipherText = new byte[plainBytes.Length];
        var tag = new byte[16]; // 128-bit authentication tag

        try
        {
            using var aes = new AesGcm(key, 16); // tag size: 16 bytes
            aes.Encrypt(iv, plainBytes, cipherText, tag);

            _logger.LogDebug(
                "Cifrado AES-256-GCM exitoso: {PlainBytes} bytes → {CipherBytes} bytes, IV={IvLength}bytes, Tag={TagLength}bytes, Salt={SaltLength}bytes",
                plainBytes.Length, cipherText.Length, iv.Length, tag.Length, salt.Length);

            return new EncryptionResult(cipherText, iv, tag, salt);
        }
        catch (CryptographicException ex)
        {
            _logger.LogError(ex, "Error durante cifrado AES-256-GCM");
            throw;
        }
    }

    /// <summary>
    /// Descifra ciphertext con AES-256-GCM usando el IV y tag proporcionados.
    /// </summary>
    public byte[] Decrypt(byte[] cipherText, byte[] key, byte[] iv, byte[] tag)
    {
        ArgumentNullException.ThrowIfNull(cipherText);
        ArgumentNullException.ThrowIfNull(key);
        ArgumentNullException.ThrowIfNull(iv);
        ArgumentNullException.ThrowIfNull(tag);

        if (key.Length != 32)
            throw new ArgumentException($"La clave debe tener 32 bytes (256 bits). Recibidos: {key.Length} bytes.", nameof(key));

        if (iv.Length != 12)
            throw new ArgumentException($"El IV debe tener 12 bytes (96 bits). Recibidos: {iv.Length} bytes.", nameof(iv));

        if (tag.Length != 16)
            throw new ArgumentException($"El tag debe tener 16 bytes (128 bits). Recibidos: {tag.Length} bytes.", nameof(tag));

        var plainBytes = new byte[cipherText.Length];

        try
        {
            using var aes = new AesGcm(key, 16);
            aes.Decrypt(iv, cipherText, tag, plainBytes);

            _logger.LogDebug(
                "Descifrado AES-256-GCM exitoso: {CipherBytes} bytes → {PlainBytes} bytes",
                cipherText.Length, plainBytes.Length);

            return plainBytes;
        }
        catch (CryptographicException ex)
        {
            _logger.LogError(ex, "Error durante descifrado AES-256-GCM — posible clave, IV o tag incorrecto");
            throw;
        }
    }
}
