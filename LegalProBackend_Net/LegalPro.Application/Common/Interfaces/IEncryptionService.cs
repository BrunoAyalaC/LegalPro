namespace LegalPro.Application.Common.Interfaces;

/// <summary>
/// Servicio de cifrado E2EE usando AES-256-GCM.
/// Cumple con los requisitos del Owner Dashboard para proteger
/// datos sensibles (PII, claves de cifrado) en reposo.
/// </summary>
public interface IEncryptionService
{
    /// <summary>
    /// Cifra texto plano usando AES-256-GCM con IV aleatorio de 12 bytes y salt de 16 bytes.
    /// </summary>
    /// <param name="plainText">Texto plano a cifrar.</param>
    /// <param name="key">Clave de 32 bytes (256 bits) para AES-256.</param>
    /// <returns>Resultado con ciphertext, IV, tag de autenticación y salt.</returns>
    EncryptionResult Encrypt(string plainText, byte[] key);

    /// <summary>
    /// Descifra ciphertext usando AES-256-GCM.
    /// </summary>
    /// <param name="cipherText">Datos cifrados.</param>
    /// <param name="key">Clave de 32 bytes (256 bits).</param>
    /// <param name="iv">IV de 12 bytes usado durante el cifrado.</param>
    /// <param name="tag">Tag de autenticación GCM de 16 bytes.</param>
    /// <returns>Texto plano descifrado en bytes (UTF-8).</returns>
    byte[] Decrypt(byte[] cipherText, byte[] key, byte[] iv, byte[] tag);
}

/// <summary>
/// Resultado del cifrado AES-256-GCM.
/// </summary>
/// <param name="CipherText">Datos cifrados.</param>
/// <param name="Iv">Vector de inicialización (12 bytes).</param>
/// <param name="Tag">Tag de autenticación GCM (16 bytes).</param>
/// <param name="Salt">Salt aleatorio (16 bytes) para derivación de clave.</param>
public record EncryptionResult(byte[] CipherText, byte[] Iv, byte[] Tag, byte[] Salt);
