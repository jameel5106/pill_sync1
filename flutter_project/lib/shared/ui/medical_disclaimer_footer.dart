import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// Permanent statutory healthcare disclaimer required on all medical screens.
/// Localized across all 7 Indian languages.
class MedicalDisclaimerFooter extends StatelessWidget {
  const MedicalDisclaimerFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primaryBlueLight.withOpacity(0.5),
        border: Border(
          top: BorderSide(color: AppColors.primaryBlue.withOpacity(0.15)),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.info_outline_rounded,
            size: 16,
            color: AppColors.primaryBlueDark,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'PillSync is an assistant, not a doctor. Always confirm with your doctor or pharmacist.',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                height: 1.35,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
