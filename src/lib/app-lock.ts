/**
 * App lock — PIN and optional biometric (WebAuthn platform authenticator).
 *
 * Everything is device-local: the PIN never leaves the browser and is stored
 * as a salted SHA-256 hash in localStorage. Biometric unlock registers a
 * discoverable platform credential and treats a successful assertion as
 * "same person, same device"; nothing is verified server-side because the
 * lock is a privacy screen, not an authentication boundary (Firebase Auth
 * remains that).
 */

export const APP_LOCK_KEYS = {
  enabled: 'flousy_lock_enabled',
  hash: 'flousy_lock_hash',
  salt: 'flousy_lock_salt',
  timeout: 'flousy_lock_timeout_s',
  lastActive: 'flousy_lock_last_active',
  biometric: 'flousy_lock_biometric_id',
} as const;

export const LOCK_TIMEOUT_OPTIONS = [0, 60, 300, 900] as const;
export type LockTimeout = (typeof LOCK_TIMEOUT_OPTIONS)[number];

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  // Iterated hashing keeps a stolen localStorage dump from being trivially
  // brute-forced for 4-digit PINs on the device itself.
  let digest = await crypto.subtle.digest('SHA-256', data);
  for (let i = 0; i < 2000; i += 1) {
    digest = await crypto.subtle.digest('SHA-256', digest);
  }
  return toHex(digest);
}

export interface AppLockSettings {
  enabled: boolean;
  timeoutSeconds: LockTimeout;
  biometricEnabled: boolean;
}

export function readAppLockSettings(store: StorageLike | null = storage()): AppLockSettings {
  if (!store) return { enabled: false, timeoutSeconds: 0, biometricEnabled: false };
  const enabled = store.getItem(APP_LOCK_KEYS.enabled) === 'true' && Boolean(store.getItem(APP_LOCK_KEYS.hash));
  const rawTimeout = Number(store.getItem(APP_LOCK_KEYS.timeout));
  const timeoutSeconds = (LOCK_TIMEOUT_OPTIONS as readonly number[]).includes(rawTimeout)
    ? (rawTimeout as LockTimeout)
    : 0;
  return {
    enabled,
    timeoutSeconds,
    biometricEnabled: Boolean(store.getItem(APP_LOCK_KEYS.biometric)),
  };
}

export async function enableAppLock(pin: string, store: StorageLike | null = storage()): Promise<boolean> {
  if (!store || !isValidPin(pin)) return false;
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  store.setItem(APP_LOCK_KEYS.salt, salt);
  store.setItem(APP_LOCK_KEYS.hash, hash);
  store.setItem(APP_LOCK_KEYS.enabled, 'true');
  touchAppLock(store);
  return true;
}

export function disableAppLock(store: StorageLike | null = storage()): void {
  if (!store) return;
  Object.values(APP_LOCK_KEYS).forEach((key) => store.removeItem(key));
}

export function setLockTimeout(seconds: LockTimeout, store: StorageLike | null = storage()): void {
  store?.setItem(APP_LOCK_KEYS.timeout, String(seconds));
}

export async function verifyPin(pin: string, store: StorageLike | null = storage()): Promise<boolean> {
  if (!store) return false;
  const salt = store.getItem(APP_LOCK_KEYS.salt);
  const expected = store.getItem(APP_LOCK_KEYS.hash);
  if (!salt || !expected || !isValidPin(pin)) return false;
  const actual = await hashPin(pin, salt);
  return actual === expected;
}

/** Record activity so the idle timeout is measured from the last interaction. */
export function touchAppLock(store: StorageLike | null = storage(), nowMs = Date.now()): void {
  store?.setItem(APP_LOCK_KEYS.lastActive, String(nowMs));
}

/**
 * Whether the lock screen must be shown: enabled and either never unlocked
 * on this page load (`sessionUnlocked` false) or idle beyond the timeout.
 */
export function shouldLock(
  sessionUnlocked: boolean,
  settings: AppLockSettings = readAppLockSettings(),
  store: StorageLike | null = storage(),
  nowMs = Date.now(),
): boolean {
  if (!settings.enabled) return false;
  if (!sessionUnlocked) return true;
  if (settings.timeoutSeconds === 0) return false;
  const last = Number(store?.getItem(APP_LOCK_KEYS.lastActive));
  if (!Number.isFinite(last) || last <= 0) return true;
  return nowMs - last > settings.timeoutSeconds * 1000;
}

/* ------------------------------------------------------------------------ */
/* Biometric (WebAuthn platform authenticator)                               */
/* ------------------------------------------------------------------------ */

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    if (!window.isSecureContext) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function registerBiometric(
  userLabel: string,
  store: StorageLike | null = storage(),
): Promise<boolean> {
  if (!store || !(await isBiometricAvailable())) return false;
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'SmartJib', id: window.location.hostname },
        user: { id: userId, name: userLabel || 'smartjib-user', displayName: userLabel || 'SmartJib' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;
    if (!credential) return false;
    store.setItem(APP_LOCK_KEYS.biometric, base64url(credential.rawId));
    return true;
  } catch {
    return false;
  }
}

export function removeBiometric(store: StorageLike | null = storage()): void {
  store?.removeItem(APP_LOCK_KEYS.biometric);
}

export async function unlockWithBiometric(store: StorageLike | null = storage()): Promise<boolean> {
  if (!store) return false;
  const id = store.getItem(APP_LOCK_KEYS.biometric);
  if (!id) return false;
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromBase64url(id) as BufferSource }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}
