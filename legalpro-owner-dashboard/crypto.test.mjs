import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

// ── 1. IMPLEMENTACIÓN DEL CIFRADO (Copiado de server.js para validación unitaria) ─────────────────
function encryptData(data, secret) {
  try {
    const salt = crypto.randomBytes(16);
    // PBKDF2: 100,000 iteraciones, SHA-256, clave de 32 bytes (256 bits)
    const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      salt: salt.toString('hex')
    };
  } catch (err) {
    throw new Error('Error de cifrado interno.');
  }
}

// ── 2. IMPLEMENTACIÓN DEL DESCIFRADO FRONTEND (Adaptado a Node.js usando Web Crypto API) ───────
// Convierte Hex String a Uint8Array
function hexToUint8Array(hex) {
  const cleanHex = hex.replace(/[^0-9a-f]/gi, '');
  if (cleanHex.length % 2 !== 0) throw new Error('Cadena hex inválida.');
  const length = cleanHex.length / 2;
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return arr;
}

// Descifra usando la Web Crypto API (SubtleCrypto) idéntico a SubtleCrypto en el frontend (public/app.js)
async function decryptPayload(ciphertextHex, ivHex, tagHex, saltHex, secretPhrase) {
  const webcrypto = globalThis.crypto || crypto.webcrypto;
  if (!webcrypto || !webcrypto.subtle) {
    throw new Error('Web Crypto API no disponible en este entorno.');
  }

  const encoder = new TextEncoder();
  const phraseBuffer = encoder.encode(secretPhrase);
  const saltArr = hexToUint8Array(saltHex);

  // 1. Importar la frase de contraseña como clave de PBKDF2
  const baseKey = await webcrypto.subtle.importKey(
    'raw',
    phraseBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // 2. Derivar clave AES-GCM usando PBKDF2 (100,000 iteraciones, SHA-256)
  const aesKey = await webcrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltArr,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const ciphertextArr = hexToUint8Array(ciphertextHex);
  const ivArr = hexToUint8Array(ivHex);
  const tagArr = hexToUint8Array(tagHex);

  // 3. Concatenar ciphertext y tag para que SubtleCrypto lo procese correctamente
  const encryptedData = new Uint8Array(ciphertextArr.length + tagArr.length);
  encryptedData.set(ciphertextArr, 0);
  encryptedData.set(tagArr, ciphertextArr.length);

  // 4. Descifrar
  try {
    const decryptedBuffer = await webcrypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivArr,
        tagLength: 128
      },
      aesKey,
      encryptedData
    );

    return JSON.parse(new TextDecoder().decode(decryptedBuffer));
  } catch (err) {
    throw new Error('La frase de descifrado es incorrecta o los datos fueron alterados.');
  }
}

// ── 3. CASOS DE PRUEBA ──────────────────────────────────────────────────────────────────────────

test('E2EE Cryptography — Cifrado Backend (crypto) y Descifrado Frontend (SubtleCrypto) son compatibles', async () => {
  const secretPhrase = 'MiSuperPasswordSecretoDeOwner!';
  const originalData = {
    test: 'OK',
    kpis: {
      total_tokens: 45000,
      costo_usd: 0.12345678,
    },
    actualizadoAl: new Date().toISOString()
  };

  // Cifrar datos usando la función del Backend
  const encryptedPayload = encryptData(originalData, secretPhrase);

  assert.ok(encryptedPayload.ciphertext, 'Debe generar ciphertext');
  assert.ok(encryptedPayload.iv, 'Debe generar IV');
  assert.ok(encryptedPayload.tag, 'Debe generar tag de autenticidad');
  assert.ok(encryptedPayload.salt, 'Debe generar salt para PBKDF2');

  // Descifrar datos usando la función del Frontend (SubtleCrypto)
  const decryptedData = await decryptPayload(
    encryptedPayload.ciphertext,
    encryptedPayload.iv,
    encryptedPayload.tag,
    encryptedPayload.salt,
    secretPhrase
  );

  // Validaciones
  assert.deepStrictEqual(decryptedData, originalData, 'Los datos descifrados deben coincidir exactamente con los originales');
  assert.strictEqual(decryptedData.test, 'OK');
  assert.strictEqual(decryptedData.kpis.total_tokens, 45000);
});

test('E2EE Cryptography — Descifrado falla si se usa una frase de descifrado incorrecta', async () => {
  const secretPhraseCorrect = 'ClaveCorrectaOwner';
  const secretPhraseIncorrect = 'ClaveIncorrectaOwner';
  const originalData = { sensitive: 'datos confidenciales' };

  // Cifrar con clave correcta
  const encryptedPayload = encryptData(originalData, secretPhraseCorrect);

  // Intentar descifrar con clave incorrecta debe lanzar un error
  await assert.rejects(
    async () => {
      await decryptPayload(
        encryptedPayload.ciphertext,
        encryptedPayload.iv,
        encryptedPayload.tag,
        encryptedPayload.salt,
        secretPhraseIncorrect
      );
    },
    /La frase de descifrado es incorrecta o los datos fueron alterados/,
    'Debería fallar el descifrado con una clave incorrecta'
  );
});

test('E2EE Cryptography — Descifrado falla si los datos cifrados (ciphertext) son alterados', async () => {
  const secretPhrase = 'ClaveSecretaUnica';
  const originalData = { secret: 'top-secret-info' };

  const encryptedPayload = encryptData(originalData, secretPhrase);
  
  // Alterar un byte del ciphertext (cambiar último carácter)
  const alteredCiphertext = encryptedPayload.ciphertext.substring(0, encryptedPayload.ciphertext.length - 1) + 
                            (encryptedPayload.ciphertext.endsWith('0') ? '1' : '0');

  // Intentar descifrar datos alterados debe lanzar un error debido a que GCM detecta la alteración del tag/datos
  await assert.rejects(
    async () => {
      await decryptPayload(
        alteredCiphertext,
        encryptedPayload.iv,
        encryptedPayload.tag,
        encryptedPayload.salt,
        secretPhrase
      );
    },
    Error,
    'Debería rechazar el descifrado si los datos están corruptos'
  );
});
