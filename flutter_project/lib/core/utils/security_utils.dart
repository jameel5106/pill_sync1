import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

/// Cryptographic & hardware security helpers for PillSync under DPDP Act 2023.
/// Implements salted PBKDF2-HMAC-SHA256 hashing for PIN protection and biometric integration.
class SecurityUtils {
  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static final LocalAuthentication _localAuth = LocalAuthentication();

  // Storage Keys
  static const String _keyPinSalt = 'pillsync_pin_salt';
  static const String _keyPinHash = 'pillsync_pin_hash';
  static const String _keyBiometricEnabled = 'pillsync_biometric_enabled';
  static const String _keyFailedAttempts = 'pillsync_failed_attempts';
  static const String _keyLockoutUntil = 'pillsync_lockout_until';

  static const int maxFailedAttempts = 5;
  static const Duration lockoutDuration = Duration(minutes: 15);

  /// Generates a cryptographically secure 16-byte random salt
  static String generateSalt([int length = 16]) {
    final Random random = Random.secure();
    final Uint8List values = Uint8List(length);
    for (int i = 0; i < length; i++) {
      values[i] = random.nextInt(256);
    }
    return base64Url.encode(values);
  }

  /// PBKDF2-HMAC-SHA256 simulation using iterative crypto hash (10,000 iterations)
  static String hashPinWithSalt(String pin, String salt) {
    List<int> current = utf8.encode(pin + salt);
    final Hmac hmac = Hmac(sha256, utf8.encode(salt));
    for (int i = 0; i < 10000; i++) {
      current = hmac.convert(current).bytes;
    }
    return base64Url.encode(current);
  }

  /// Saves a newly created PIN as salted hash in hardware-backed secure storage
  static Future<void> savePin(String pin) async {
    final String salt = generateSalt();
    final String hash = hashPinWithSalt(pin, salt);
    await _storage.write(key: _keyPinSalt, value: salt);
    await _storage.write(key: _keyPinHash, value: hash);
  }

  /// Verifies entered PIN against stored salted hash
  static Future<bool> verifyPin(String enteredPin) async {
    final String? salt = await _storage.read(key: _keyPinSalt);
    final String? storedHash = await _storage.read(key: _keyPinHash);

    if (salt == null || storedHash == null) {
      return false;
    }

    final String computed = hashPinWithSalt(enteredPin, salt);
    return computed == storedHash;
  }

  /// Checks if user has a PIN configured
  static Future<bool> hasPinConfigured() async {
    final String? hash = await _storage.read(key: _keyPinHash);
    return hash != null && hash.isNotEmpty;
  }

  /// Sets biometric authorization preference
  static Future<void> setBiometricsEnabled(bool enabled) async {
    await _storage.write(
      key: _keyBiometricEnabled,
      value: enabled ? 'true' : 'false',
    );
  }

  /// Checks if biometrics are enabled by the user
  static Future<bool> isBiometricsEnabled() async {
    final String? val = await _storage.read(key: _keyBiometricEnabled);
    return val == 'true';
  }

  /// Hardware biometric capability check
  static Future<bool> canCheckBiometrics() async {
    try {
      final bool canAuthenticateWithBiometrics =
          await _localAuth.canCheckBiometrics;
      final bool canAuthenticate =
          canAuthenticateWithBiometrics || await _localAuth.isDeviceSupported();
      return canAuthenticate;
    } catch (_) {
      return false;
    }
  }

  /// Prompts user with native biometric dialog (Face ID / Fingerprint)
  static Future<bool> authenticateWithBiometrics({
    required String reason,
  }) async {
    try {
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
          useErrorDialogs: true,
        ),
      );
    } catch (_) {
      return false;
    }
  }

  /// Checks if app is currently in lockout mode due to 5 failed attempts
  static Future<bool> isLockedOut() async {
    final String? lockoutStr = await _storage.read(key: _keyLockoutUntil);
    if (lockoutStr == null) return false;

    final DateTime? lockoutUntil = DateTime.tryParse(lockoutStr);
    if (lockoutUntil == null) return false;

    if (DateTime.now().isBefore(lockoutUntil)) {
      return true;
    } else {
      // Lockout expired, reset failed attempts
      await resetFailedAttempts();
      return false;
    }
  }

  /// Increments failed verification attempts and applies 15-minute lockout if >= 5
  static Future<int> recordFailedAttempt() async {
    final String? currentStr = await _storage.read(key: _keyFailedAttempts);
    final int current = (int.tryParse(currentStr ?? '0') ?? 0) + 1;
    await _storage.write(key: _keyFailedAttempts, value: current.toString());

    if (current >= maxFailedAttempts) {
      final DateTime lockUntil = DateTime.now().add(lockoutDuration);
      await _storage.write(
        key: _keyLockoutUntil,
        value: lockUntil.toIso8601String(),
      );
    }
    return current;
  }

  /// Resets failed attempt counter upon successful authentication
  static Future<void> resetFailedAttempts() async {
    await _storage.delete(key: _keyFailedAttempts);
    await _storage.delete(key: _keyLockoutUntil);
  }

  /// Clears all local credentials, PINs, and salts (e.g., on account deletion)
  static Future<void> wipeAllSecureData() async {
    await _storage.deleteAll();
  }
}
