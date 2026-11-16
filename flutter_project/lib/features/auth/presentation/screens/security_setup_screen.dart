import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/security_utils.dart';
import '../auth_providers.dart';

/// Optional, skippable screen to configure biometrics and a salted PBKDF2 4-6 digit PIN.
class SecuritySetupScreen extends ConsumerStatefulWidget {
  const SecuritySetupScreen({super.key});

  @override
  ConsumerState<SecuritySetupScreen> createState() =>
      _SecuritySetupScreenState();
}

class _SecuritySetupScreenState extends ConsumerState<SecuritySetupScreen> {
  bool _enableBiometrics = true;
  bool _canCheckBio = false;
  final _pinController = TextEditingController();
  final _confirmPinController = TextEditingController();
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _checkHardwareBiometrics();
  }

  Future<void> _checkHardwareBiometrics() async {
    final canBio = await SecurityUtils.canCheckBiometrics();
    if (mounted) {
      setState(() {
        _canCheckBio = canBio;
        _enableBiometrics = canBio;
      });
    }
  }

  @override
  void dispose() {
    _pinController.dispose();
    _confirmPinController.dispose();
    super.dispose();
  }

  Future<void> _saveSecurity() async {
    final pin = _pinController.text.trim();
    final confirmPin = _confirmPinController.text.trim();

    if (pin.isNotEmpty) {
      if (pin.length < 4 || pin.length > 6) {
        setState(() => _error = 'PIN must be between 4 and 6 digits');
        return;
      }
      if (pin != confirmPin) {
        setState(() => _error = 'PINs do not match');
        return;
      }
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });

    try {
      if (pin.isNotEmpty) {
        // Hash PIN using PBKDF2-HMAC-SHA256 with cryptographically generated salt
        await SecurityUtils.savePin(pin);
      }

      await SecurityUtils.setBiometricsEnabled(_enableBiometrics);

      // Refresh app lock provider state
      ref.read(appLockProvider.notifier).refreshSecurityPrefs(
            pin.isNotEmpty,
            _enableBiometrics,
          );

      // Update Firestore security flags
      final repo = ref.read(authRepositoryProvider);
      await repo.updateSecurityPreferences(
        hasPin: pin.isNotEmpty,
        biometricsEnabled: _enableBiometrics,
      );

      if (mounted) {
        context.go('/home');
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Security Setup'),
        actions: [
          TextButton(
            onPressed: () => context.go('/home'),
            child: const Text('Skip for now'),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primaryBlueLight,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.shield_outlined,
                    color: AppColors.primaryBlue,
                    size: 40,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Protect Your Medical Privacy',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Under the DPDP Act 2023, your prescriptions and dosage schedules are sensitive data. Configure a PIN or biometrics to protect against unauthorized access.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 28),

              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                      color: AppColors.error,
                      fontSize: 13,
                    ),
                  ),
                ),

              // Biometric Switch
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: AppTheme.defaultBorderRadius,
                  border: Border.all(color: AppColors.border),
                  boxShadow: const [AppColors.softShadow],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.accentGreenLight,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.fingerprint_rounded,
                        color: AppColors.accentGreen,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Biometric Unlock',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Unlock with Face ID or Fingerprint',
                            style: TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: _enableBiometrics,
                      activeColor: AppColors.accentGreen,
                      onChanged: (val) {
                        setState(() => _enableBiometrics = val);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Optional 4-6 Digit PIN Setup
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: AppTheme.defaultBorderRadius,
                  border: Border.all(color: AppColors.border),
                  boxShadow: const [AppColors.softShadow],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(
                          Icons.pin_rounded,
                          color: AppColors.primaryBlue,
                          size: 22,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Set 4-6 Digit App PIN (Optional)',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Stored only as a PBKDF2 salted hash in hardware secure storage.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _pinController,
                      keyboardType: TextInputType.number,
                      obscureText: true,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        labelText: 'Enter 4-6 Digit PIN',
                        counterText: '',
                        prefixIcon: Icon(Icons.password_rounded),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _confirmPinController,
                      keyboardType: TextInputType.number,
                      obscureText: true,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        labelText: 'Confirm PIN',
                        counterText: '',
                        prefixIcon: Icon(Icons.password_rounded),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              ElevatedButton(
                onPressed: _isSaving ? null : _saveSecurity,
                child: _isSaving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(Colors.white),
                        ),
                      )
                    : const Text('Save & Finish Setup'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => context.go('/home'),
                child: const Text('Skip For Now'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
