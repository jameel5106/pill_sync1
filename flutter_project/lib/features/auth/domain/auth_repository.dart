import 'user_entity.dart';

/// Abstract AuthRepository contract.
/// Enables mock testing and swappable backend providers (Firebase, Supabase, OAuth).
abstract class AuthRepository {
  /// Emits real-time authentication changes
  Stream<UserEntity?> get authStateChanges;

  /// Returns current authenticated user snapshot
  UserEntity? get currentUser;

  /// Email & Password Sign In
  Future<UserEntity> signInWithEmail({
    required String email,
    required String password,
  });

  /// Email & Password Sign Up with DPDP Act 2023 consent capture
  Future<UserEntity> signUpWithEmail({
    required String email,
    required String password,
    required String displayName,
    required bool dpdpConsentGiven,
  });

  /// Phone OTP Auth: Initiate verification code send (+91 default)
  Future<void> sendPhoneOtp({
    required String phoneNumber,
    required Function(String verificationId, int? resendToken) onCodeSent,
    required Function(String error) onError,
    Function(dynamic user)? onAutoVerified,
  });

  /// Phone OTP Auth: Verify received 6-digit code
  Future<UserEntity> verifyPhoneOtp({
    required String verificationId,
    required String smsCode,
    String? displayName,
    required bool dpdpConsentGiven,
  });

  /// Send password reset link
  Future<void> sendPasswordResetEmail(String email);

  /// Signs out and resets active session tokens
  Future<void> signOut();

  /// Under DPDP Act 2023, completely purges user Firestore document and auth credentials
  Future<void> deleteAccountAndData({required String confirmPasswordOrPin});

  /// Updates security preferences (biometrics / PIN flags in Firestore)
  Future<void> updateSecurityPreferences({
    required bool hasPin,
    required bool biometricsEnabled,
  });
}
