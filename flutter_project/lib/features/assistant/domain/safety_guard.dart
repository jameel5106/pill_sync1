import 'package:flutter/foundation.dart';

/// Safety Guard for PillSync Medical Assistant under DPDP Act & Medical Safety Rules.
/// Two-layer detection:
/// Layer 1: Client-side Regex & Token scan in 7 languages (en, hi, ur, te, bn, mr, ta).
/// Layer 2: Model output safety flags & emergency classification.
class SafetyGuard {
  SafetyGuard._();

  /// Critical emergency keywords across all 7 supported Indian languages.
  /// If ANY match occurs, immediately halt LLM response and redirect to EmergencyScreen.
  static final Map<String, List<String>> emergencyKeywords = {
    'en': [
      'chest pain',
      'heart attack',
      'cannot breathe',
      'can\'t breathe',
      'shortness of breath',
      'stroke',
      'unconscious',
      'seizure',
      'overdose',
      'poison',
      'severe bleeding',
      'suicide',
      'kill myself',
      'end my life',
      'anaphylaxis',
    ],
    'hi': [
      'सीने में दर्द',
      'सांस नहीं आ रही',
      'दिल का दौरा',
      'बेहोश',
      'दौरा',
      'जहर',
      'खून बह रहा',
      'आत्महत्या',
      'मरना चाहता',
      'ओवरडोज',
    ],
    'ur': [
      'سینے میں درد',
      'سانس نہیں آرہی',
      'دل کا دورہ',
      'بے ہوش',
      'زہر',
      'خون بہہ رہا',
      'خودکشی',
    ],
    'te': [
      'గుండె నొప్పి',
      'శ్వాస ఆడటం లేదు',
      'గుండెపోటు',
      'స్పృహ కోల్పోవడం',
      'విషం',
      'రక్తస్రావం',
      'ఆత్మహత్య',
    ],
    'bn': [
      'বুকে ব্যথা',
      'শ্বাস নিতে পারছি না',
      'হার্ট অ্যাটাক',
      'অজ্ঞান',
      'বিষ',
      'রক্তপাত',
      'আত্মহত্যা',
    ],
    'mr': [
      'छातीत दुखणे',
      'श्वास घेता येत नाही',
      'हार्ट अटॅक',
      'बेशुद्ध',
      'विष',
      'रक्तस्त्राव',
      'आत्महत्या',
    ],
    'ta': [
      'நெஞ்சு வலி',
      'மூச்சு விட முடியவில்லை',
      'மாரடைப்பு',
      'மயக்கம்',
      'விஷம்',
      'இரத்தப்போக்கு',
      'தற்கொலை',
    ],
  };

  /// Evaluates user query against multi-language safety dictionary.
  /// Returns [SafetyCheckResult] indicating whether it is safe or an emergency.
  static SafetyCheckResult evaluateInput(String userInput, {String? languageCode}) {
    final cleanInput = userInput.trim().toLowerCase();
    if (cleanInput.isEmpty) {
      return const SafetyCheckResult.safe();
    }

    // 1. Check current language keywords
    if (languageCode != null && emergencyKeywords.containsKey(languageCode)) {
      for (final keyword in emergencyKeywords[languageCode]!) {
        if (cleanInput.contains(keyword.toLowerCase())) {
          return SafetyCheckResult.emergency(
            matchedKeyword: keyword,
            detectedLanguage: languageCode,
            reason: 'Critical emergency symptom detected in user query.',
          );
        }
      }
    }

    // 2. Scan across all languages as fallback (polyglot speech in India)
    for (final entry in emergencyKeywords.entries) {
      for (final keyword in entry.value) {
        if (cleanInput.contains(keyword.toLowerCase())) {
          return SafetyCheckResult.emergency(
            matchedKeyword: keyword,
            detectedLanguage: entry.key,
            reason: 'Critical symptom detected: "$keyword".',
          );
        }
      }
    }

    return const SafetyCheckResult.safe();
  }

  /// System instruction prepended to any Gemini query for prescription Q&A.
  /// Strictly forbids diagnosis, dose alteration, and stopping prescriptions.
  static const String assistantSystemPrompt = '''
You are "PillSync Safe Assistant", an empathetic prescription explanation companion.
STRICT BOUNDARIES:
1. NEVER diagnose illnesses or tell the user what disease they might have.
2. NEVER recommend changing doses, stopping medication, or switching drugs.
3. If the user asks whether they can skip or take double, instruct them to call their prescribing doctor or pharmacist immediately.
4. Only explain:
   - What the prescribed medicine is generally used for (in simple 6th-grade language).
   - How to take it (e.g. with water after meals, avoid dairy if applicable).
   - Common non-dangerous side effects (e.g. mild drowsiness, nausea) with guidance on when to consult their doctor.
5. If any symptom sounds severe or like an adverse allergic reaction (swelling, hives, wheezing), command them to seek emergency care immediately.
6. Always end responses with: "Please confirm with your doctor or pharmacist before making any medical decisions."
''';
}

@immutable
class SafetyCheckResult {
  final bool isEmergency;
  final String? matchedKeyword;
  final String? detectedLanguage;
  final String? reason;

  const SafetyCheckResult.safe()
      : isEmergency = false,
        matchedKeyword = null,
        detectedLanguage = null,
        reason = null;

  const SafetyCheckResult.emergency({
    required this.matchedKeyword,
    required this.detectedLanguage,
    required this.reason,
  }) : isEmergency = true;
}
