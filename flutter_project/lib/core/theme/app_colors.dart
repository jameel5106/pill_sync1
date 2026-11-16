import 'package:flutter/material.dart';

/// Centralized, strict color definitions for PillSync.
/// Note: No hardcoded colors should ever exist outside this file.
class AppColors {
  // Brand Primaries
  static const Color primaryBlue = Color(0xFF1E88E5);
  static const Color primaryBlueDark = Color(0xFF1565C0);
  static const Color primaryBlueLight = Color(0xFFE3F2FD);

  // Brand Accents
  static const Color accentGreen = Color(0xFF2E9E6B);
  static const Color accentGreenDark = Color(0xFF238255);
  static const Color accentGreenLight = Color(0xFFE8F5E9);

  // Neutrals & Surface
  static const Color background = Color(0xFFF9FAFB);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceCard = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE5E7EB);
  static const Color divider = Color(0xFFF3F4F6);

  // Typography (WCAG AA Compliant)
  static const Color textPrimary = Color(0xFF1F2937); // High contrast dark charcoal
  static const Color textSecondary = Color(0xFF6B7280); // Accessible medium gray
  static const Color textDisabled = Color(0xFF9CA3AF);
  static const Color textOnPrimary = Color(0xFFFFFFFF);

  // Functional & Feedback
  static const Color error = Color(0xFFDC2626);
  static const Color errorLight = Color(0xFFFEF2F2);
  static const Color warning = Color(0xFFD97706);
  static const Color warningLight = Color(0xFFFFFBEB);
  static const Color success = Color(0xFF2E9E6B);
  static const Color info = Color(0xFF1E88E5);

  // Shadows
  static const BoxShadow softShadow = BoxShadow(
    color: Color(0x0D000000), // 5% black
    blurRadius: 10,
    offset: Offset(0, 4),
    spreadRadius: 0,
  );

  static const BoxShadow cardShadow = BoxShadow(
    color: Color(0x14000000), // 8% black
    blurRadius: 16,
    offset: Offset(0, 6),
    spreadRadius: -2,
  );
}
