import crypto from 'crypto';

// AES-256-GCM: authenticated encryption, so a tampered/corrupted ciphertext
// fails to decrypt instead of silently returning garbage. Used to store
// connection credentials (DB passwords, S3 keys, API tokens) at rest instead
// of as plaintext in a pipeline's node config.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM

function getKey(secretKey: string): Buffer {
  // Accepts either a 64-char hex string (32 bytes) or any passphrase, in
  // which case it's hashed down to a 32-byte key — convenient for local dev
  // where generating a proper hex key is one more thing to remember.
  if (/^[0-9a-f]{64}$/i.test(secretKey)) {
    return Buffer.from(secretKey, 'hex');
  }
  return crypto.createHash('sha256').update(secretKey).digest();
}

/** Returns a single string ("iv:authTag:ciphertext", all hex) safe to store as one field. */
export function encryptSecret(plaintext: string, secretKey: string): string {
  const key = getKey(secretKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string, secretKey: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed encrypted payload');
  }
  const key = getKey(secretKey);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
