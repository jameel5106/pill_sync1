import 'package:flutter/material.dart';

/// Language configuration item for PillSync.
class AppLanguage {
  final String code;
  final String nativeName;
  final String englishName;
  final TextDirection textDirection;
  final String scriptFont;

  const AppLanguage({
    required this.code,
    required this.nativeName,
    required this.englishName,
    this.textDirection = TextDirection.ltr,
    required this.scriptFont,
  });

  bool get isRTL => textDirection == TextDirection.rtl;
  Locale get locale => Locale(code);
}

/// Extensible language configuration array.
/// New Indian regional languages (e.g. Gujarati, Malayalam, Kannada, Punjabi)
/// can simply be appended here.
class AppLanguages {
  static const List<AppLanguage> supported = [
    AppLanguage(
      code: 'en',
      nativeName: 'English',
      englishName: 'English',
      scriptFont: 'Inter',
    ),
    AppLanguage(
      code: 'hi',
      nativeName: 'हिन्दी',
      englishName: 'Hindi',
      scriptFont: 'NotoSansDevanagari',
    ),
    AppLanguage(
      code: 'ur',
      nativeName: 'اردو',
      englishName: 'Urdu',
      textDirection: TextDirection.rtl,
      scriptFont: 'NotoNastaliqUrdu',
    ),
    AppLanguage(
      code: 'te',
      nativeName: 'తెలుగు',
      englishName: 'Telugu',
      scriptFont: 'NotoSansTelugu',
    ),
    AppLanguage(
      code: 'bn',
      nativeName: 'বাংলা',
      englishName: 'Bengali',
      scriptFont: 'NotoSansBengali',
    ),
    AppLanguage(
      code: 'mr',
      nativeName: 'मराठी',
      englishName: 'Marathi',
      scriptFont: 'NotoSansDevanagari',
    ),
    AppLanguage(
      code: 'ta',
      nativeName: 'தமிழ்',
      englishName: 'Tamil',
      scriptFont: 'NotoSansTamil',
    ),
  ];

  static const String defaultCode = 'en';

  static AppLanguage findByCode(String code) {
    return supported.firstWhere(
      (lang) => lang.code == code,
      orElse: () => supported.first,
    );
  }

  static List<Locale> get supportedLocales =>
      supported.map((l) => l.locale).toList();
}
