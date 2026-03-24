import { scryptSync, timingSafeEqual } from 'node:crypto';

const HASH_PREFIX = 'scrypt$';

export function verifyPassword(password: string, encodedHash: string): boolean {
  if (!encodedHash.startsWith(HASH_PREFIX)) {
    return false;
  }

  const [, salt, expectedHash] = encodedHash.split('$');

  if (!salt || !expectedHash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attemptsByKey = new Map<string, RateLimitEntry>();

export function canAttemptLogin(key: string): boolean {
  const now = Date.now();
  const current = attemptsByKey.get(key);

  if (!current || current.resetAt <= now) {
    attemptsByKey.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return true;
  }

  return current.count < MAX_ATTEMPTS;
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const current = attemptsByKey.get(key);

  if (!current || current.resetAt <= now) {
    attemptsByKey.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  current.count += 1;
}

export function clearLoginAttempts(key: string): void {
  attemptsByKey.delete(key);
}
