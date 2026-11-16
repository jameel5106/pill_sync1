/// Maps raw Firebase Auth & Firestore error codes into human-friendly messages
/// without exposing sensitive tokens, phone numbers, or passwords.
class FirebaseErrorMapper {
  static String getFriendlyMessage(dynamic error, [String? fallback]) {
    final String errorStr = error.toString().toLowerCase();

    if (errorStr.contains('user-not-found') ||
        errorStr.contains('wrong-password') ||
        errorStr.contains('invalid-credential')) {
      return 'The email or password you entered is incorrect. Please try again.';
    }

    if (errorStr.contains('email-already-in-use')) {
      return 'An account already exists with this email address.';
    }

    if (errorStr.contains('invalid-email')) {
      return 'Please enter a valid email address.';
    }

    if (errorStr.contains('weak-password')) {
      return 'Your password is too weak. Please use at least 8 characters with letters, numbers, and symbols.';
    }

    if (errorStr.contains('invalid-verification-code') ||
        errorStr.contains('session-expired')) {
      return 'The 6-digit verification code is invalid or has expired. Please request a new code.';
    }

    if (errorStr.contains('quota-exceeded') ||
        errorStr.contains('too-many-requests')) {
      return 'Too many attempts. For security, please wait a few moments before trying again.';
    }

    if (errorStr.contains('network-request-failed')) {
      return 'Network connection unavailable. Changes will sync once back online.';
    }

    if (errorStr.contains('permission-denied')) {
      return 'Access restricted according to healthcare privacy rules.';
    }

    return fallback ??
        'An unexpected error occurred. Please verify your details and try again.';
  }
}
