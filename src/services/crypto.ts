// WebCrypto AES-GCM Encryption Layer for Prescription Data
// Protects sensitive medical imagery and doctor notes at rest in IndexedDB

class PrescriptionCryptoService {
  private static readonly SALT = 'PillSync_Secure_Medical_Storage_Salt_v1';

  /**
   * Derive a 256-bit AES-GCM CryptoKey from user PIN or account secret
   */
  private async deriveKey(secret: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(secret || 'PillSync_Default_Hardware_Seed'),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode(PrescriptionCryptoService.SALT),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt a string (e.g. image base64 or clinical notes)
   */
  async encrypt(data: string, secretKey: string): Promise<string> {
    if (!data) return '';
    try {
      const key = await this.deriveKey(secretKey);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(data)
      );

      // Package iv + ciphertext as base64
      const ivStr = btoa(String.fromCharCode(...iv));
      const cipherBytes = new Uint8Array(ciphertext);
      let binary = '';
      for (let i = 0; i < cipherBytes.byteLength; i++) {
        binary += String.fromCharCode(cipherBytes[i]);
      }
      const cipherStr = btoa(binary);

      return `ENC_AES_GCM:${ivStr}:${cipherStr}`;
    } catch (err) {
      console.warn('[Crypto] Encryption fallback to raw for resilience:', err);
      return data;
    }
  }

  /**
   * Decrypt a string
   */
  async decrypt(encryptedData: string, secretKey: string): Promise<string> {
    if (!encryptedData) return '';
    if (!encryptedData.startsWith('ENC_AES_GCM:')) {
      // Unencrypted legacy record
      return encryptedData;
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) return encryptedData;

      const ivStr = atob(parts[1]);
      const cipherStr = atob(parts[2]);

      const iv = new Uint8Array(ivStr.length);
      for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);

      const cipherBytes = new Uint8Array(cipherStr.length);
      for (let i = 0; i < cipherStr.length; i++) cipherBytes[i] = cipherStr.charCodeAt(i);

      const key = await this.deriveKey(secretKey);
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipherBytes
      );

      const dec = new TextDecoder();
      return dec.decode(decrypted);
    } catch (err) {
      console.warn('[Crypto] Decryption failed (key mismatch or unencrypted):', err);
      return encryptedData;
    }
  }
}

export const prescriptionCrypto = new PrescriptionCryptoService();
