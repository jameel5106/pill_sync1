import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Modal dialog displaying India's DPDP Act 2023 compliance terms,
/// medical privacy guarantees, and data fiduciary commitments.
class DpdpConsentDialog extends StatelessWidget {
  final bool isTerms;

  const DpdpConsentDialog({super.key, this.isTerms = false});

  static Future<void> show(BuildContext context, {bool isTerms = false}) {
    return showDialog(
      context: context,
      builder: (ctx) => DpdpConsentDialog(isTerms: isTerms),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: const RoundedRectangleBorder(
        borderRadius: AppTheme.defaultBorderRadius,
      ),
      backgroundColor: AppColors.surface,
      title: Row(
        children: [
          Icon(
            isTerms ? Icons.gavel_rounded : Icons.verified_user_rounded,
            color: AppColors.primaryBlue,
            size: 24,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isTerms ? 'Terms of Service' : 'DPDP Privacy Policy',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.accentGreenLight,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Jurisdiction: Digital Personal Data Protection Act, 2023 (Republic of India) • Version: 1.0.0',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentGreenDark,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                '1. Data Fiduciary Commitment',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 4),
              const Text(
                'PillSync processes handwritten prescription images and schedule notes strictly for your personal medical adherence and translation into your preferred Indian regional language.',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              const Text(
                '2. Purpose Limitation & Non-Disclosure',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 4),
              const Text(
                'Your healthcare records will never be sold, leased, or transmitted to third-party advertisers or insurance brokers. All data is scoped exclusively to your private account.',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              const Text(
                '3. Right to Erasure & Deletion',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 4),
              const Text(
                'In full accordance with Section 12 of the DPDP Act 2023, you have the unconditional right to delete your account. This initiates an immediate, irreversible wipe of your prescriptions, schedules, and cryptographic tokens.',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              const Text(
                '4. On-Device Encryption & Security',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 4),
              const Text(
                'Your 4-6 digit PIN is never stored in plain text; only an irreversible salted PBKDF2 hash is maintained in the secure hardware enclave.',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ),
      actions: [
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(),
          style: ElevatedButton.styleFrom(
            minimumSize: const Size(120, 48),
          ),
          child: const Text('I Understand'),
        ),
      ],
    );
  }
}
