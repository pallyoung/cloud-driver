import { randomBytes, scryptSync } from 'node:crypto';

const HASH_PREFIX = 'scrypt';

export function createPasswordHash(password: string): string {
  const trimmed = password.trim();

  if (!trimmed) {
    throw new Error('Password cannot be empty.');
  }

  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(trimmed, salt, 64).toString('hex');
  return `${HASH_PREFIX}$${salt}$${hash}`;
}

export function createSessionSecret(): string {
  return randomBytes(24).toString('hex');
}
