/// Structured medicine model extracted from handwritten doctor prescription.
/// Conforms to safety rules: NEVER guesses; flagged with illegible & confidence.
class ParsedMedicine {
  final String id;
  final String name;
  final String? genericName;
  final String strength; // e.g. "500 mg", "10 ml"
  final String form; // tablet, capsule, syrup, injection, drops, ointment, other
  final String dose; // e.g. "1 tablet", "5 ml"
  final String frequency; // e.g. "1-0-1", "1-1-1", "OD", "BD", "SOS"
  final String timing; // before_food, after_food, with_food, empty_stomach, bedtime, unspecified
  final int? durationDays;
  final String? instructions;
  final double confidence; // 0.0 to 1.0
  final bool illegible;
  final bool userVerified;

  const ParsedMedicine({
    required this.id,
    required this.name,
    this.genericName,
    required this.strength,
    this.form = 'tablet',
    required this.dose,
    required this.frequency,
    this.timing = 'after_food',
    this.durationDays,
    this.instructions,
    required this.confidence,
    this.illegible = false,
    this.userVerified = false,
  });

  bool get needsReview => confidence < 0.75 || illegible || !userVerified;

  ParsedMedicine copyWith({
    String? name,
    String? genericName,
    String? strength,
    String? form,
    String? dose,
    String? frequency,
    String? timing,
    int? durationDays,
    String? instructions,
    double? confidence,
    bool? illegible,
    bool? userVerified,
  }) {
    return ParsedMedicine(
      id: id,
      name: name ?? this.name,
      genericName: genericName ?? this.genericName,
      strength: strength ?? this.strength,
      form: form ?? this.form,
      dose: dose ?? this.dose,
      frequency: frequency ?? this.frequency,
      timing: timing ?? this.timing,
      durationDays: durationDays ?? this.durationDays,
      instructions: instructions ?? this.instructions,
      confidence: confidence ?? this.confidence,
      illegible: illegible ?? this.illegible,
      userVerified: userVerified ?? this.userVerified,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'genericName': genericName,
    'strength': strength,
    'form': form,
    'dose': dose,
    'frequency': frequency,
    'timing': timing,
    'durationDays': durationDays,
    'instructions': instructions,
    'confidence': confidence,
    'illegible': illegible,
    'userVerified': userVerified,
  };

  factory ParsedMedicine.fromMap(Map<String, dynamic> map, [String? fallbackId]) {
    return ParsedMedicine(
      id: (map['id'] as String?) ?? fallbackId ?? 'med_${DateTime.now().millisecondsSinceEpoch}',
      name: (map['name'] as String?) ?? 'Unknown Medicine',
      genericName: map['genericName'] as String?,
      strength: (map['strength'] as String?) ?? '',
      form: (map['form'] as String?) ?? 'tablet',
      dose: (map['dose'] as String?) ?? '1',
      frequency: (map['frequency'] as String?) ?? '1-0-1',
      timing: (map['timing'] as String?) ?? 'after_food',
      durationDays: (map['durationDays'] as num?)?.toInt(),
      instructions: map['instructions'] as String?,
      confidence: ((map['confidence'] as num?)?.toDouble()) ?? 0.5,
      illegible: (map['illegible'] as bool?) ?? false,
      userVerified: (map['userVerified'] as bool?) ?? false,
    );
  }
}

/// Full parsed prescription structure including doctor, clinic, and follow-up notes.
class ParsedPrescriptionResult {
  final String? doctorName;
  final String? clinic;
  final DateTime? date;
  final String? patientName;
  final String? notes; // e.g. "Review after 5 days"
  final List<ParsedMedicine> medicines;
  final bool aiConsentChecked;

  const ParsedPrescriptionResult({
    this.doctorName,
    this.clinic,
    this.date,
    this.patientName,
    this.notes,
    required this.medicines,
    this.aiConsentChecked = true,
  });

  bool get allMedicinesConfirmed => medicines.every((m) => !m.needsReview);

  Map<String, dynamic> toMap() => {
    'doctorName': doctorName,
    'clinic': clinic,
    'date': date?.toIso8601String(),
    'patientName': patientName,
    'notes': notes,
    'medicines': medicines.map((m) => m.toMap()).toList(),
    'aiConsentChecked': aiConsentChecked,
  };
}
