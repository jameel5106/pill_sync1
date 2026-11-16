/**
 * Real Authentication & Security Service for PillSync.
 * Uses Web Crypto API for PBKDF2-HMAC-SHA256 password & PIN hashing with cryptographically random salt.
 * Offline-First Auth: preserves sessions, supports offline PIN & Biometric unlock, and protects against offline account creation.
 */

import { dbService, UserAccount, PatientProfile } from './db';

const SESSION_KEY = 'pillsync_active_uid';
const BACKGROUND_TIME_KEY = 'pillsync_bg_timestamp';
const BIOMETRIC_CRED_KEY = 'pillsync_bio_enabled';

// Helper: Convert ArrayBuffer to Hex
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Generate random salt
function generateSalt(): string {
  const randomBytes = new Uint8Array(16);
  window.crypto.getRandomValues(randomBytes);
  return bufferToHex(randomBytes.buffer);
}

// Helper: Hash password/PIN with PBKDF2-HMAC-SHA256
async function hashSecret(secret: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const saltBytes = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bufferToHex(derivedBits);
}

export class AuthService {
  private currentUser: UserAccount | null = null;
  private currentPin: string = '';

  // Initialize or restore active session
  async initSession(): Promise<UserAccount | null> {
    const activeUid = localStorage.getItem(SESSION_KEY);
    if (!activeUid) {
      this.currentUser = null;
      return null;
    }

    const user = await dbService.getUserById(activeUid);
    if (!user) {
      this.logout();
      return null;
    }

    this.currentUser = user;
    return user;
  }

  getCurrentUser(): UserAccount | null {
    return this.currentUser;
  }

  getEncryptionKey(): string {
    return this.currentPin || this.currentUser?.salt || 'pillsync_offline_secret';
  }

  // REAL SIGN-UP (Requires Internet)
  async signUp(params: {
    name: string;
    email: string;
    password: string;
    dpdpConsent: boolean;
    preferredLanguage?: string;
  }): Promise<UserAccount> {
    if (!navigator.onLine) {
      throw new Error(
        'You are currently offline. Please connect to the internet to create a new account or reset your password.'
      );
    }

    const cleanEmail = params.email.toLowerCase().trim();

    if (!cleanEmail || !params.name.trim()) {
      throw new Error('Please provide your name and email address.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    if (params.password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    if (!params.dpdpConsent) {
      throw new Error('You must accept the DPDP Act Privacy Policy to create an account.');
    }

    // Check if user already exists
    const existing = await dbService.getUserByEmail(cleanEmail);
    if (existing) {
      throw new Error('An account with this email address already exists. Please log in.');
    }

    const salt = generateSalt();
    const passwordHash = await hashSecret(params.password, salt);
    const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const newUser: UserAccount = {
      id: userId,
      name: params.name.trim(),
      email: cleanEmail,
      passwordHash,
      salt,
      dpdpConsent: {
        accepted: true,
        timestamp: new Date().toISOString(),
        version: '1.2.0',
      },
      preferredLanguage: params.preferredLanguage || 'en',
      createdAt: new Date().toISOString(),
    };

    await dbService.saveUser(newUser);

    // Auto-create default "Me" patient profile for this user
    const defaultProfile: PatientProfile = {
      id: `prof_me_${userId}`,
      userId: userId,
      name: params.name.trim(),
      relation: 'Self',
      age: 30,
      language: params.preferredLanguage || 'en',
      isDefault: true,
      createdAt: new Date().toISOString(),
    };
    await dbService.saveProfile(defaultProfile);

    // Save session
    localStorage.setItem(SESSION_KEY, userId);
    this.currentUser = newUser;
    return newUser;
  }

  // REAL LOGIN (Works offline if previously signed in on this device)
  async login(email: string, password: string): Promise<UserAccount> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !password) {
      throw new Error('Please enter both email and password.');
    }

    const user = await dbService.getUserByEmail(cleanEmail);
    if (!user) {
      if (!navigator.onLine) {
        throw new Error(
          'You are offline and no offline record for this account was found on this device. Please connect to the internet to sign in.'
        );
      }
      throw new Error('No account found with this email address.');
    }

    const testHash = await hashSecret(password, user.salt);
    if (testHash !== user.passwordHash) {
      throw new Error('Incorrect password. Please try again.');
    }

    localStorage.setItem(SESSION_KEY, user.id);
    this.currentUser = user;
    return user;
  }

  // LOGOUT
  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(BACKGROUND_TIME_KEY);
    this.currentUser = null;
    this.currentPin = '';
  }

  // DELETE ACCOUNT & DATA (DPDP Right to be Forgotten)
  async deleteAccount(): Promise<void> {
    if (!this.currentUser) return;
    const uid = this.currentUser.id;
    await dbService.wipeUserData(uid);
    this.logout();
  }

  // PIN MANAGEMENT & OFFLINE UNLOCK
  async setPin(pin: string): Promise<void> {
    if (!this.currentUser) throw new Error('Not signed in.');
    if (pin.length < 4 || pin.length > 6) {
      throw new Error('PIN must be 4 to 6 digits.');
    }
    const pinHash = await hashSecret(pin, this.currentUser.salt);
    this.currentUser.pinHash = pinHash;
    this.currentPin = pin;
    await dbService.saveUser(this.currentUser);
  }

  async verifyPin(pin: string): Promise<boolean> {
    if (!this.currentUser || !this.currentUser.pinHash) return true;
    const testHash = await hashSecret(pin, this.currentUser.salt);
    if (testHash === this.currentUser.pinHash) {
      this.currentPin = pin;
      return true;
    }
    return false;
  }

  // BIOMETRIC / WEBAUTHN UNLOCK
  async isBiometricAvailable(): Promise<boolean> {
    return (
      typeof window !== 'undefined' &&
      !!window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function' &&
      (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  }

  async enableBiometric(): Promise<boolean> {
    try {
      if (!window.PublicKeyCredential) return false;
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userIdBytes = new TextEncoder().encode(this.currentUser?.id || 'pillsync');

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'PillSync Health' },
          user: {
            id: userIdBytes,
            name: this.currentUser?.email || 'patient@pillsync.app',
            displayName: this.currentUser?.name || 'PillSync Patient',
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      });

      if (credential) {
        localStorage.setItem(BIOMETRIC_CRED_KEY, 'true');
        return true;
      }
    } catch (e) {
      console.warn('Biometric registration error:', e);
    }
    return false;
  }

  async authenticateBiometric(): Promise<boolean> {
    try {
      if (!window.PublicKeyCredential) return false;
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          userVerification: 'required',
          timeout: 60000,
        },
      });

      return !!assertion;
    } catch (e) {
      console.warn('Biometric auth failed:', e);
      return false;
    }
  }

  isBiometricEnabled(): boolean {
    return localStorage.getItem(BIOMETRIC_CRED_KEY) === 'true';
  }

  // BACKGROUND LOCK TRACKER (1 minute timeout)
  recordBackgroundTime(): void {
    localStorage.setItem(BACKGROUND_TIME_KEY, Date.now().toString());
  }

  shouldTriggerPinLock(): boolean {
    if (!this.currentUser?.pinHash) return false;
    const bgTimeStr = localStorage.getItem(BACKGROUND_TIME_KEY);
    if (!bgTimeStr) return false;
    const elapsed = Date.now() - parseInt(bgTimeStr, 10);
    return elapsed >= 60000; // 60 seconds (1 minute)
  }

  clearBackgroundTime(): void {
    localStorage.removeItem(BACKGROUND_TIME_KEY);
  }
}

export const authService = new AuthService();
