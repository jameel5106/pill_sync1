import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../data/firebase_auth_repository.dart';
import '../domain/auth_repository.dart';
import '../domain/user_entity.dart';
import '../../../core/utils/security_utils.dart';
import '../../../core/i18n/app_languages.dart';

// --- AUTH REPOSITORY PROVIDER ---
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return FirebaseAuthRepository();
});

// --- AUTH STREAM PROVIDER ---
final authStateProvider = StreamProvider<UserEntity?>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  return repo.authStateChanges;
});

// --- CURRENT USER PROVIDER ---
final currentUserProvider = Provider<UserEntity?>((ref) {
  return ref.watch(authStateProvider).valueOrNull;
});

// --- LOCALE / LANGUAGE PROVIDER ---
class LanguageNotifier extends StateNotifier<AppLanguage> {
  LanguageNotifier() : super(AppLanguages.supported.first);

  void setLanguage(String code) {
    state = AppLanguages.findByCode(code);
  }
}

final languageProvider =
    StateNotifierProvider<LanguageNotifier, AppLanguage>((ref) {
  return LanguageNotifier();
});

// --- CONNECTIVITY PROVIDER ---
final connectivityStatusProvider = StreamProvider<ConnectivityResult>((ref) {
  return Connectivity().onConnectivityChanged.map((results) {
    if (results.isEmpty) return ConnectivityResult.none;
    return results.first;
  });
});

// --- AUTH CONTROLLER STATE ---
class AuthState {
  final bool isLoading;
  final String? errorMessage;
  final String? phoneVerificationId;
  final int? resendToken;
  final bool isPhoneCodeSent;

  const AuthState({
    this.isLoading = false,
    this.errorMessage,
    this.phoneVerificationId,
    this.resendToken,
    this.isPhoneCodeSent = false,
  });

  AuthState copyWith({
    bool? isLoading,
    String? errorMessage,
    String? phoneVerificationId,
    int? resendToken,
    bool? isPhoneCodeSent,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      phoneVerificationId: phoneVerificationId ?? this.phoneVerificationId,
      resendToken: resendToken ?? this.resendToken,
      isPhoneCodeSent: isPhoneCodeSent ?? this.isPhoneCodeSent,
    );
  }
}

// --- AUTH CONTROLLER ---
class AuthController extends StateNotifier<AuthState> {
  final AuthRepository _repository;

  AuthController(this._repository) : super(const AuthState());

  Future<bool> signInWithEmail(String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.signInWithEmail(email: email, password: password);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  Future<bool> signUpWithEmail({
    required String email,
    required String password,
    required String displayName,
    required bool dpdpConsentGiven,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.signUpWithEmail(
        email: email,
        password: password,
        displayName: displayName,
        dpdpConsentGiven: dpdpConsentGiven,
      );
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  Future<void> sendPhoneOtp(String phoneNumber) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    await _repository.sendPhoneOtp(
      phoneNumber: phoneNumber,
      onCodeSent: (verificationId, token) {
        state = state.copyWith(
          isLoading: false,
          phoneVerificationId: verificationId,
          resendToken: token,
          isPhoneCodeSent: true,
        );
      },
      onError: (error) {
        state = state.copyWith(isLoading: false, errorMessage: error);
      },
    );
  }

  Future<bool> verifyPhoneOtp({
    required String smsCode,
    String? displayName,
    required bool dpdpConsentGiven,
  }) async {
    if (state.phoneVerificationId == null) {
      state = state.copyWith(errorMessage: 'No active OTP verification session.');
      return false;
    }

    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.verifyPhoneOtp(
        verificationId: state.phoneVerificationId!,
        smsCode: smsCode,
        displayName: displayName,
        dpdpConsentGiven: dpdpConsentGiven,
      );
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  Future<void> sendPasswordReset(String email) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.sendPasswordResetEmail(email);
      state = state.copyWith(isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  Future<void> signOut() async {
    await _repository.signOut();
  }

  Future<bool> deleteAccount(String passwordOrPin) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.deleteAccountAndData(confirmPasswordOrPin: passwordOrPin);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  return AuthController(repo);
});

// --- APP LOCK STATE & CONTROLLER ---
class AppLockState {
  final bool isLocked;
  final DateTime? backgroundedTimestamp;
  final bool hasPin;
  final bool biometricsEnabled;

  const AppLockState({
    this.isLocked = false,
    this.backgroundedTimestamp,
    this.hasPin = false,
    this.biometricsEnabled = false,
  });

  AppLockState copyWith({
    bool? isLocked,
    DateTime? backgroundedTimestamp,
    bool? hasPin,
    bool? biometricsEnabled,
  }) {
    return AppLockState(
      isLocked: isLocked ?? this.isLocked,
      backgroundedTimestamp:
          backgroundedTimestamp ?? this.backgroundedTimestamp,
      hasPin: hasPin ?? this.hasPin,
      biometricsEnabled: biometricsEnabled ?? this.biometricsEnabled,
    );
  }
}

class AppLockNotifier extends StateNotifier<AppLockState> {
  AppLockNotifier() : super(const AppLockState()) {
    _initSecurityPrefs();
  }

  Future<void> _initSecurityPrefs() async {
    final hasPin = await SecurityUtils.hasPinConfigured();
    final bio = await SecurityUtils.isBiometricsEnabled();
    state = state.copyWith(hasPin: hasPin, biometricsEnabled: bio);
  }

  void onAppBackgrounded() {
    state = state.copyWith(backgroundedTimestamp: DateTime.now());
  }

  Future<void> onAppResumed() async {
    final bgTime = state.backgroundedTimestamp;
    if (bgTime != null) {
      final elapsed = DateTime.now().difference(bgTime);
      // Lock if app was backgrounded for more than 1 minute (60 seconds)
      if (elapsed.inSeconds >= 60 && (state.hasPin || state.biometricsEnabled)) {
        state = state.copyWith(isLocked: true);
      }
    }
  }

  void lockImmediately() {
    state = state.copyWith(isLocked: true);
  }

  void unlock() {
    state = state.copyWith(isLocked: false, backgroundedTimestamp: null);
  }

  void refreshSecurityPrefs(bool hasPin, bool biometrics) {
    state = state.copyWith(hasPin: hasPin, biometricsEnabled: biometrics);
  }
}

final appLockProvider =
    StateNotifierProvider<AppLockNotifier, AppLockState>((ref) {
  return AppLockNotifier();
});
