import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/prescription_repository.dart';
import '../domain/prescription_model.dart';
import '../domain/patient_profile.dart';
import '../domain/quality_check_result.dart';

final prescriptionRepositoryProvider = Provider<PrescriptionRepository>((ref) {
  return PrescriptionRepository();
});

/// Profiles list provider (auto-loads "Me" default on first login)
final patientProfilesProvider = FutureProvider<List<PatientProfile>>((ref) async {
  final repo = ref.watch(prescriptionRepositoryProvider);
  return repo.getPatientProfiles();
});

/// Real-time stream of uploaded prescriptions
final prescriptionsStreamProvider = StreamProvider<List<PrescriptionModel>>((ref) {
  final repo = ref.watch(prescriptionRepositoryProvider);
  return repo.streamPrescriptions();
});

class CaptureState {
  final File? rawFile;
  final File? processedFile;
  final QualityCheckResult? qualityResult;
  final bool isAnalyzing;
  final bool isUploading;
  final double uploadProgress;
  final String? errorMessage;
  final PrescriptionModel? lastSavedPrescription;

  const CaptureState({
    this.rawFile,
    this.processedFile,
    this.qualityResult,
    this.isAnalyzing = false,
    this.isUploading = false,
    this.uploadProgress = 0.0,
    this.errorMessage,
    this.lastSavedPrescription,
  });

  CaptureState copyWith({
    File? rawFile,
    File? processedFile,
    QualityCheckResult? qualityResult,
    bool? isAnalyzing,
    bool? isUploading,
    double? uploadProgress,
    String? errorMessage,
    PrescriptionModel? lastSavedPrescription,
  }) {
    return CaptureState(
      rawFile: rawFile ?? this.rawFile,
      processedFile: processedFile ?? this.processedFile,
      qualityResult: qualityResult ?? this.qualityResult,
      isAnalyzing: isAnalyzing ?? this.isAnalyzing,
      isUploading: isUploading ?? this.isUploading,
      uploadProgress: uploadProgress ?? this.uploadProgress,
      errorMessage: errorMessage,
      lastSavedPrescription:
          lastSavedPrescription ?? this.lastSavedPrescription,
    );
  }
}

class CaptureController extends StateNotifier<CaptureState> {
  final PrescriptionRepository _repository;

  CaptureController(this._repository) : super(const CaptureState());

  /// Process newly captured/picked image: checks 10MB, analyzes quality, compresses to max 1600px
  Future<bool> processImage(File file) async {
    state = state.copyWith(
      rawFile: file,
      isAnalyzing: true,
      errorMessage: null,
    );

    try {
      // 1. Quality inspection
      final quality = await _repository.inspectQuality(file);

      // 2. Compress to max 1600px long edge
      final compressed = await _repository.compressPrescriptionImage(file);

      state = state.copyWith(
        processedFile: compressed,
        qualityResult: quality,
        isAnalyzing: false,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isAnalyzing: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  /// Saves local copy and uploads to Firebase Storage
  Future<bool> savePrescription({
    required String profileId,
    required String profileName,
    String? doctorName,
    required DateTime date,
  }) async {
    final file = state.processedFile ?? state.rawFile;
    if (file == null) {
      state = state.copyWith(errorMessage: 'No image file to upload.');
      return false;
    }

    state = state.copyWith(
      isUploading: true,
      uploadProgress: 0.05,
      errorMessage: null,
    );

    try {
      final saved = await _repository.saveAndUploadPrescription(
        imageFile: file,
        profileId: profileId,
        profileName: profileName,
        doctorName: doctorName,
        prescriptionDate: date,
        onProgress: (p) {
          state = state.copyWith(uploadProgress: p);
        },
      );

      state = state.copyWith(
        isUploading: false,
        uploadProgress: 1.0,
        lastSavedPrescription: saved,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isUploading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  void reset() {
    state = const CaptureState();
  }
}

final captureControllerProvider =
    StateNotifierProvider<CaptureController, CaptureState>((ref) {
  final repo = ref.watch(prescriptionRepositoryProvider);
  return CaptureController(repo);
});
