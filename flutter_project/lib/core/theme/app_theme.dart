import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_colors.dart';

/// Centralized Material 3 AppTheme for PillSync.
/// Enforces 12px radius, 48dp+ touch targets, 16-18sp base typography, and WCAG AA contrast.
class AppTheme {
  AppTheme._();

  static const double borderRadiusValue = 12.0;
  static const BorderRadius defaultBorderRadius = BorderRadius.all(
    Radius.circular(borderRadiusValue),
  );

  /// Resolves the matching typography family based on language code
  static String getFontFamilyForLocale(String? languageCode) {
    switch (languageCode) {
      case 'hi':
      case 'mr':
        return 'NotoSansDevanagari';
      case 'ur':
        return 'NotoNastaliqUrdu';
      case 'bn':
        return 'NotoSansBengali';
      case 'te':
        return 'NotoSansTelugu';
      case 'ta':
        return 'NotoSansTamil';
      case 'en':
      default:
        return 'Inter';
    }
  }

  /// Builds the light theme using AppColors and locale font family
  static ThemeData light([String? languageCode]) {
    final String fontFamily = getFontFamilyForLocale(languageCode);

    return ThemeData(
      useMaterial3: true,
      fontFamily: fontFamily,
      brightness: Brightness.light,
      primaryColor: AppColors.primaryBlue,
      scaffoldBackgroundColor: AppColors.background,

      colorScheme: const ColorScheme(
        brightness: Brightness.light,
        primary: AppColors.primaryBlue,
        onPrimary: AppColors.textOnPrimary,
        secondary: AppColors.accentGreen,
        onSecondary: AppColors.textOnPrimary,
        error: AppColors.error,
        onError: AppColors.textOnPrimary,
        surface: AppColors.surface,
        onSurface: AppColors.textPrimary,
        surfaceContainerLowest: AppColors.surface,
        outline: AppColors.border,
      ),

      // App Bar styling
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: true,
        scrolledUnderElevation: 1,
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle: SystemUiOverlayStyle.dark.copyWith(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
        ),
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
      ),

      // Card styling with 12px radius and soft elevation
      cardTheme: const CardTheme(
        color: AppColors.surfaceCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: defaultBorderRadius,
          side: BorderSide(color: AppColors.border, width: 1),
        ),
        margin: EdgeInsets.zero,
      ),

      // Elevated Button: 48dp+ height (52dp), 12px radius
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryBlue,
          foregroundColor: AppColors.textOnPrimary,
          minimumSize: const Size(double.infinity, 52), // > 48dp touch target
          shape: const RoundedRectangleBorder(
            borderRadius: defaultBorderRadius,
          ),
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          textStyle: TextStyle(
            fontFamily: fontFamily,
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        ),
      ),

      // Outlined Button
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primaryBlue,
          minimumSize: const Size(double.infinity, 52),
          side: const BorderSide(color: AppColors.primaryBlue, width: 1.5),
          shape: const RoundedRectangleBorder(
            borderRadius: defaultBorderRadius,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          textStyle: TextStyle(
            fontFamily: fontFamily,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // Text Button
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primaryBlue,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          textStyle: TextStyle(
            fontFamily: fontFamily,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // Input Decoration: 12px radius, WCAG contrast borders & labels
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        labelStyle: const TextStyle(
          color: AppColors.textSecondary,
          fontSize: 15,
        ),
        hintStyle: const TextStyle(
          color: AppColors.textDisabled,
          fontSize: 15,
        ),
        errorStyle: const TextStyle(
          color: AppColors.error,
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
        enabledBorder: const OutlineInputBorder(
          borderRadius: defaultBorderRadius,
          borderSide: BorderSide(color: AppColors.border, width: 1.2),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: defaultBorderRadius,
          borderSide: BorderSide(color: AppColors.primaryBlue, width: 2),
        ),
        errorBorder: const OutlineInputBorder(
          borderRadius: defaultBorderRadius,
          borderSide: BorderSide(color: AppColors.error, width: 1.2),
        ),
        focusedErrorBorder: const OutlineInputBorder(
          borderRadius: defaultBorderRadius,
          borderSide: BorderSide(color: AppColors.error, width: 2),
        ),
      ),

      // Typography (base font 16-18sp, system scaling respected)
      textTheme: TextTheme(
        headlineMedium: TextStyle(
          fontFamily: fontFamily,
          fontSize: 26,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
          height: 1.25,
        ),
        headlineSmall: TextStyle(
          fontFamily: fontFamily,
          fontSize: 22,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
          height: 1.3,
        ),
        titleLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
          height: 1.35,
        ),
        titleMedium: TextStyle(
          fontFamily: fontFamily,
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        bodyLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 17, // 16-18sp baseline
          fontWeight: FontWeight.w400,
          color: AppColors.textPrimary,
          height: 1.5,
        ),
        bodyMedium: TextStyle(
          fontFamily: fontFamily,
          fontSize: 15,
          fontWeight: FontWeight.w400,
          color: AppColors.textSecondary,
          height: 1.45,
        ),
        labelLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }
}
