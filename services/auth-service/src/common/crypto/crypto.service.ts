import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Symmetric-encryption helper used by the auth-service to protect
 * secrets at rest â€” specifically the TOTP seed stored in
 * `User.twoFactorSecret`. Uses AES-256-GCM (authenticated encryption)
 * so tampered ciphertext is rejected at decryption time.
 *
 * The encryption key is derived with scrypt from the `ENCRYPTION_KEY`
 * environment variable so that a short configured secret still produces
 * a full 32-byte AES key. The salt is domain-constant (the app name)
 * because we don't need per-record salts â€” GCM's random IV provides the
 * uniqueness, and the input key is long-lived.
 *
 * Wire format of the returned string:
 *
 *     <iv-hex>:<tag-hex>:<ciphertext-hex>
 *
 * All three fields are hex-encoded so the whole thing is ASCII-safe
 * and fits in a Postgres `text` column without escaping.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.get<string>('ENCRYPTION_KEY');
    if (!secret || secret.length < 16) {
      throw new Error(
        'ENCRYPTION_KEY is not configured (or is shorter than 16 characters)',
      );
    }
    const salt = config.get<string>('ENCRYPTION_SALT') ?? 'SZDevs.auth.v1';
    this.key = scryptSync(secret, salt, 32);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }
    const [ivHex, tagHex, ctHex] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ct = Buffer.from(ctHex, 'hex');

    if (iv.length !== 12) {
      throw new Error('Invalid IV length');
    }
    if (tag.length !== 16) {
      throw new Error('Invalid auth tag length');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plaintext.toString('utf8');
  }
}
