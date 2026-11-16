/// Immutable Domain User Entity representing an authenticated PillSync user.
/// Conforms to DPDP Act 2023 minimal data collection requirements.
class UserEntity {
  final String uid;
  final String? email;
  final String? phoneNumber;
  final String displayName;
  final bool dpdpConsentGiven;
  final DateTime? dpdpConsentTimestamp;
  final String dpdpPolicyVersion;
  final bool hasPinConfigured;
  final bool biometricsEnabled;
  final DateTime createdAt;

  const UserEntity({
    required this.uid,
    this.email,
    this.phoneNumber,
    required this.displayName,
    required this.dpdpConsentGiven,
    this.dpdpConsentTimestamp,
    this.dpdpPolicyVersion = '1.0.0-dpdp-2023',
    this.hasPinConfigured = false,
    this.biometricsEnabled = false,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'email': email,
      'phoneNumber': phoneNumber,
      'displayName': displayName,
      'dpdpConsent': {
        'consentGiven': dpdpConsentGiven,
        'timestamp': dpdpConsentTimestamp?.toIso8601String(),
        'policyVersion': dpdpPolicyVersion,
        'jurisdiction': 'IN_DPDP_ACT_2023',
      },
      'security': {
        'hasPinConfigured': hasPinConfigured,
        'biometricsEnabled': biometricsEnabled,
      },
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': DateTime.now().toIso8601String(),
    };
  }

  factory UserEntity.fromMap(Map<String, dynamic> map, String uid) {
    final consentMap = map['dpdpConsent'] as Map<String, dynamic>? ?? {};
    final secMap = map['security'] as Map<String, dynamic>? ?? {};

    return UserEntity(
      uid: uid,
      email: map['email'] as String?,
      phoneNumber: map['phoneNumber'] as String?,
      displayName: (map['displayName'] as String?) ?? 'PillSync User',
      dpdpConsentGiven: (consentMap['consentGiven'] as bool?) ?? false,
      dpdpConsentTimestamp: consentMap['timestamp'] != null
          ? DateTime.tryParse(consentMap['timestamp'] as String)
          : null,
      dpdpPolicyVersion:
          (consentMap['policyVersion'] as String?) ?? '1.0.0-dpdp-2023',
      hasPinConfigured: (secMap['hasPinConfigured'] as bool?) ?? false,
      biometricsEnabled: (secMap['biometricsEnabled'] as bool?) ?? false,
      createdAt: map['createdAt'] != null
          ? DateTime.tryParse(map['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  UserEntity copyWith({
    String? displayName,
    bool? dpdpConsentGiven,
    DateTime? dpdpConsentTimestamp,
    String? dpdpPolicyVersion,
    bool? hasPinConfigured,
    bool? biometricsEnabled,
  }) {
    return UserEntity(
      uid: uid,
      email: email,
      phoneNumber: phoneNumber,
      displayName: displayName ?? this.displayName,
      dpdpConsentGiven: dpdpConsentGiven ?? this.dpdpConsentGiven,
      dpdpConsentTimestamp: dpdpConsentTimestamp ?? this.dpdpConsentTimestamp,
      dpdpPolicyVersion: dpdpPolicyVersion ?? this.dpdpPolicyVersion,
      hasPinConfigured: hasPinConfigured ?? this.hasPinConfigured,
      biometricsEnabled: biometricsEnabled ?? this.biometricsEnabled,
      createdAt: createdAt,
    );
  }
}
