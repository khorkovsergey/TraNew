import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Envelope encryption for the wealth record.
 *
 * A master key lives in the environment. Each user gets their own random data key,
 * stored encrypted under the master key; field values are encrypted with the data
 * key. Two consequences worth stating: rotating one person's key touches only their
 * rows, and a leaked ciphertext column is useless without the master key.
 *
 * Limitation to be explicit about: the master key sits in platform configuration,
 * not in a KMS or HSM. Anyone who can read the service's environment can decrypt.
 * Moving it behind a KMS with per-request unwrapping is the next step before this
 * holds real customer money.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function masterKey(): Buffer {
  const raw = process.env.WEALTH_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'WEALTH_ENCRYPTION_KEY is not set — refusing to read or write wealth data unencrypted.'
    );
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `WEALTH_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes; got ${key.length}.`
    );
  }
  return key;
}

/** iv:tag:ciphertext, each base64, so the parts stay unambiguous in one column. */
function seal(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function open(key: Buffer, payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Ciphertext is malformed.');

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Ciphertext is malformed.');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  // GCM raises on a tag mismatch, so tampering fails loudly rather than silently.
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Creates a fresh per-user data key, returned raw and sealed under the master key. */
export function createDataKey(): { key: Buffer; sealed: string } {
  const key = randomBytes(KEY_BYTES);
  return { key, sealed: seal(masterKey(), key.toString('base64')) };
}

export function unwrapDataKey(sealed: string): Buffer {
  return Buffer.from(open(masterKey(), sealed), 'base64');
}

export function encryptField(dataKey: Buffer, value: string): string {
  return seal(dataKey, value);
}

export function decryptField(dataKey: Buffer, payload: string): string {
  return open(dataKey, payload);
}

/** Constant-time compare for tokens that are checked by value. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Convenience for generating a master key: `node -e "..."` during setup. */
export function generateMasterKey(): string {
  return randomBytes(KEY_BYTES).toString('base64');
}
