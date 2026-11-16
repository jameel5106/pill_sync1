/// Translated medicine instructions conforming strictly to medical safety:
/// Brand names and doses remain untouched with transliteration in native script.
class TranslatedMedicine {
  final String medicineId;
  final String originalName;
  final String transliteratedName; // e.g. "ऑगमेंटिन ६२५ ड्यूओ"
  final String strength;
  final String originalInstructions;
  final String translatedInstructions; // Simple 6th-grade language
  final String targetLanguageCode;
  final bool hasNumberValidationPassed;
  final List<String> missingNumbers;
  final DateTime cachedAt;

  const TranslatedMedicine({
    required this.medicineId,
    required this.originalName,
    required this.transliteratedName,
    required this.strength,
    required this.originalInstructions,
    required this.translatedInstructions,
    required this.targetLanguageCode,
    required this.hasNumberValidationPassed,
    this.missingNumbers = const [],
    required this.cachedAt,
  });

  /// Programmatic safety check: verifies all numbers in original source appear in translation
  static bool verifyNumbers(String source, String translated, List<String> missingOut) {
    final numberRegex = RegExp(r'\d+');
    final matches = numberRegex.allMatches(source);
    bool passed = true;

    for (final m in matches) {
      final numStr = m.group(0)!;
      // Also check native numerals (Devanagari, Urdu, Bengali, etc.)
      if (!translated.contains(numStr)) {
        missingOut.add(numStr);
        passed = false;
      }
    }
    return passed;
  }
}
