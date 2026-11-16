enum PrescriptionStatus {
  uploaded,
  needsReview,
  confirmed;

  String get label {
    switch (this) {
      case PrescriptionStatus.uploaded:
        return 'Uploaded';
      case PrescriptionStatus.needsReview:
        return 'Needs Review';
      case PrescriptionStatus.confirmed:
        return 'Confirmed';
    }
  }

  static PrescriptionStatus fromString(String? val) {
    switch (val?.toLowerCase()) {
      case 'needsreview':
      case 'needs_review':
        return PrescriptionStatus.needsReview;
      case 'confirmed':
        return PrescriptionStatus.confirmed;
      case 'uploaded':
      default:
        return PrescriptionStatus.uploaded;
    }
  }
}

/// Domain model representing a captured handwritten doctor prescription.
/// Conforms to DPDP Act 2023 with patient profile attribution and Firestore scoping.
class PrescriptionModel {
  final String id;
  final String userId;
  final String profileId;
  final String profileName;
  final String? doctorName;
  final DateTime prescriptionDate;
  final String localFilePath;
  final String? storageUrl;
  final String storagePath;
  final PrescriptionStatus status;
  final int fileSizeBytes;
  final bool isOfflineQueued;
  final double uploadProgress;
  final String? errorMessage;
  final DateTime createdAt;

  const PrescriptionModel({
    required this.id,
    required this.userId,
    required this.profileId,
    required this.profileName,
    this.doctorName,
    required this.prescriptionDate,
    required this.localFilePath,
    this.storageUrl,
    required this.storagePath,
    this.status = PrescriptionStatus.uploaded,
    this.fileSizeBytes = 0,
    this.isOfflineQueued = false,
    this.uploadProgress = 1.0,
    this.errorMessage,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'profileId': profileId,
      'profileName': profileName,
      'doctorName': doctorName,
      'prescriptionDate': prescriptionDate.toIso8601String(),
      'storagePath': storagePath,
      'storageUrl': storageUrl,
      'status': status.name,
      'fileSizeBytes': fileSizeBytes,
      'isOfflineQueued': isOfflineQueued,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': DateTime.now().toIso8601String(),
    };
  }

  factory PrescriptionModel.fromMap(Map<String, dynamic> map, String id) {
    return PrescriptionModel(
      id: id,
      userId: map['userId'] as String? ?? '',
      profileId: map['profileId'] as String? ?? 'default',
      profileName: map['profileName'] as String? ?? 'Me',
      doctorName: map['doctorName'] as String?,
      prescriptionDate: map['prescriptionDate'] != null
          ? DateTime.tryParse(map['prescriptionDate'] as String) ?? DateTime.now()
          : DateTime.now(),
      localFilePath: map['localFilePath'] as String? ?? '',
      storageUrl: map['storageUrl'] as String?,
      storagePath: map['storagePath'] as String? ?? '',
      status: PrescriptionStatus.fromString(map['status'] as String?),
      fileSizeBytes: (map['fileSizeBytes'] as num?)?.toInt() ?? 0,
      isOfflineQueued: map['isOfflineQueued'] as bool? ?? false,
      uploadProgress: 1.0,
      createdAt: map['createdAt'] != null
          ? DateTime.tryParse(map['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  PrescriptionModel copyWith({
    String? localFilePath,
    String? storageUrl,
    PrescriptionStatus? status,
    bool? isOfflineQueued,
    double? uploadProgress,
    String? errorMessage,
  }) {
    return PrescriptionModel(
      id: id,
      userId: userId,
      profileId: profileId,
      profileName: profileName,
      doctorName: doctorName,
      prescriptionDate: prescriptionDate,
      localFilePath: localFilePath ?? this.localFilePath,
      storageUrl: storageUrl ?? this.storageUrl,
      storagePath: storagePath,
      status: status ?? this.status,
      fileSizeBytes: fileSizeBytes,
      isOfflineQueued: isOfflineQueued ?? this.isOfflineQueued,
      uploadProgress: uploadProgress ?? this.uploadProgress,
      errorMessage: errorMessage ?? this.errorMessage,
      createdAt: createdAt,
    );
  }
}
