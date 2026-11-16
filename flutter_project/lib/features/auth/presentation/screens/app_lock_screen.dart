import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/security_utils.dart';
import '../auth_providers.dart';

/// App Lock Screen displayed when returning from background after > 1 minute.
/// Protects sensitive medical prescription history with biometric authentication or PIN unlock.
class AppLockScreen extends ConsumerStatefulWidget {
  const AppLockScreen({super.key});

  @override
  ConsumerState<AppLockScreen> createState() => _AppLockScreenState();
}

class _AppLockScreenState extends ConsumerState<AppLockScreen> {
  final _pinController = TextEditingController();
  bool _isLockedOut = false;
  String? _errorMessage;
  int _failedAttempts = 0;

  @override
  void initState() {
    super.initState();
    _checkStatusAndPromptBiometrics();
  }

  Future<void> _checkStatusAndPromptBiometrics() async {
    final locked = await SecurityUtils.isLockedOut();
    if (locked) {
      if (mounted) setState(() => _isLockedOut = true);
      return;
    }

    final isBioEnabled = await SecurityUtils.isBiometricsEnabled();
    if (isBioEnabled) {
      final success = await SecurityUtils.authenticateWithBiometrics(
        reason: 'Unlock PillSync to access your prescription records',
      );
      if (success && mounted) {
        ref.read(appLockProvider.notifier).unlock();
        context.go('/home');
      }
    }
  }

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _handlePinUnlock() async {
    if (_isLockedOut) return;

    final pin = _pinController.text.trim();
    if (pin.isEmpty) {
      setState(() => _errorMessage = 'Please enter your security PIN');
      return;
    }

    final isValid = await SecurityUtils.verifyPin(pin);
    if (isValid) {
      await SecurityUtils.resetFailedAttempts();
      ref.read(appLockProvider.notifier).unlock();
      if (mounted) {
        context.go('/home');
      }
    } else {
      _failedAttempts = await SecurityUtils.recordFailedAttempt();
      final isLocked = await SecurityUtils.isLockedOut();
      setState(() {
        _isLockedOut = isLocked;
        _errorMessage = isLocked
            ? 'Account locked for 15 minutes due to 5 failed PIN attempts.'
            : 'Incorrect PIN. Attempt $_failedAttempts of 5.';
      });
      _pinController.clear();
    }
  }

  Future<void> _handleLogoutFallback() async {
    ref.read(appLockProvider.notifier).unlock();
    await ref.read(authControllerProvider.notifier).signOut();
    if (mounted) {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false, // Prevent physical back navigation while locked
      child: Scaffold(
        body: Container(
          width: double.infinity,
          height: double.infinity,
          color: AppColors.background,
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 32.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 40),
                  Center(
                    child: Container(
                      width: 88,
                      height: 88,
                      decoration: BoxDecoration(
                        color: AppColors.primaryBlueLight,
                        shape: BoxShape.circle,
                        boxShadow: const [AppColors.softShadow],
                      ),
                      child: const Icon(
                        Icons.lock_rounded,
                        color: AppColors.primaryBlue,
                        size: 48,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'PillSync is Locked',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'For your medical data confidentiality under DPDP Act 2023, please verify your identity.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 32),

                  if (_errorMessage != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 20),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.errorLight,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.error,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),

                  // PIN Input
                  TextField(
                    controller: _pinController,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    enabled: !_isLockedOut,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 10,
                    ),
                    decoration: const InputDecoration(
                      hintText: '• • • •',
                      counterText: '',
                      contentPadding: EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                  const SizedBox(height: 20),

                  ElevatedButton(
                    onPressed: _isLockedOut ? null : _handlePinUnlock,
                    child: const Text('Unlock with PIN'),
                  ),
                  const SizedBox(height: 12),

                  OutlinedButton.icon(
                    onPressed: _isLockedOut
                        ? null
                        : () => _checkStatusAndPromptBiometrics(),
                    icon: const Icon(Icons.fingerprint_rounded, size: 22),
                    label: const Text('Use Biometrics (Face / Fingerprint)'),
                  ),
                  const SizedBox(height: 32),

                  // Logout fallback
                  Center(
                    child: TextButton.icon(
                      onPressed: _handleLogoutFallback,
                      icon: const Icon(Icons.logout_rounded,
                          size: 18, color: AppColors.error),
                      label: const Text(
                        'Forgot PIN? Sign out from this device',
                        style: TextStyle(
                          color: AppColors.error,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
