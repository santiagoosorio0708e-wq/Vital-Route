import crypto from 'crypto';
import { env } from '../config/env';
import type { EncryptedPayload } from '../types/dispatch.types';

/**
 * Cifra las coordenadas antes de enviarlas a la tablet del paramédico.
 *
 * Se usa AES-256-GCM porque además de cifrar autentica: si alguien altera un
 * byte del mensaje en tránsito, la verificación del authTag falla y la tablet
 * descarta el paquete en lugar de llevar a la ambulancia a una dirección falsa.
 */
class CryptoService {
  private readonly key: Buffer;

  constructor() {
    const hexKey = env.gpsEncryptionKey;
    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
      throw new Error(
        'GPS_ENCRYPTION_KEY debe ser una cadena hexadecimal de 64 caracteres (32 bytes). ' +
          'Genera una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(data: unknown): EncryptedPayload {
    // IV nuevo en cada mensaje: cifrar dos veces lo mismo nunca da el mismo resultado.
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    const plaintext = JSON.stringify(data);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return {
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  /** Lo usa la tablet. Queda aquí para poder probar el ciclo completo. */
  decrypt<T>(payload: EncryptedPayload): T {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(payload.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(plaintext) as T;
  }
}

export const cryptoService = new CryptoService();
