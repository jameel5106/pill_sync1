/// Patient profile under a PillSync account (e.g. "Me", "Mother", "Father", "Child").
/// Created with default "Me" on first login under DPDP Act 2023.
class PatientProfile {
  final String id;
  final String name;
  final String relation; // 'self', 'parent', 'spouse', 'child', 'other'
  final bool isDefault;
  final DateTime createdAt;

  const PatientProfile({
    required this.id,
    required this.name,
    this.relation = 'self',
    this.isDefault = false,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'relation': relation,
      'isDefault': isDefault,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  factory PatientProfile.fromMap(Map<String, dynamic> map, String id) {
    return PatientProfile(
      id: id,
      name: map['name'] as String? ?? 'Me',
      relation: map['relation'] as String? ?? 'self',
      isDefault: map['isDefault'] as bool? ?? false,
      createdAt: map['createdAt'] != null
          ? DateTime.tryParse(map['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  static PatientProfile defaultSelf(String uid) {
    return PatientProfile(
      id: 'profile_self_$uid',
      name: 'Me',
      relation: 'self',
      isDefault: true,
      createdAt: DateTime.now(),
    );
  }
}
