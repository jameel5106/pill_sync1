import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:path_provider/path_provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:file_picker/file_picker.dart';
import 'package:pdfx/pdfx.dart';
import '../domain/prescription_model.dart';
import '../domain/patient_profile.dart';
import '../domain/quality_check_result.dart';

class PrescriptionRepository {
  final FirebaseFirestore _firestore;
  final FirebaseStorage _storage;
  final FirebaseAuth _auth;
  final ImagePicker _picker;

  PrescriptionRepository({
    FirebaseFirestore? firestore,
    FirebaseStorage? storage,
    FirebaseAuth? auth,
    ImagePicker? picker,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _storage = storage ?? FirebaseStorage.instance,
        _auth = auth ?? FirebaseAuth.instance,
        _picker = picker ?? ImagePicker();

  String get _currentUserId {
    final user = _auth.currentUser;
    if (user == null) throw Exception('User is not authenticated.');
    return user.uid;
  }

  // --- SOURCE PICKING (Camera, Gallery, PDF) ---

  /// Picks from Camera with high resolution
  Future<File?> pickFromCamera() async {
    final XFile? file = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 100,
      preferredCameraDevice: CameraDevice.rear,
    );
    if (file == null) return null;
    return _validateAndConvert(File(file.path));
  }

  /// Picks from Gallery (supports JPEG, PNG, HEIC)
  Future<File?> pickFromGallery() async {
    final XFile? file = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 100,
    );
    if (file == null) return null;
    return _validateAndConvert(File(file.path));
  }

  /// Imports first page of a medical PDF document
  Future<File?> pickPdfDocument() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
    );
    if (result == null || result.files.single.path == null) return null;

    final File pdfFile = File(result.files.single.path!);
    final int size = await pdfFile.length();
    if (size > 10 * 1024 * 1024) {
      throw Exception('PDF exceeds the 10 MB maximum limit.');
    }

    // Render first page to image via pdfx
    final document = await PdfDocument.openFile(pdfFile.path);
    final page = await document.getPage(1);
    final pageImage = await page.render(
      width: page.width * 2,
      height: page.height * 2,
      format: PdfPageImageFormat.jpeg,
    );
    await page.close();
    await document.close();

    if (pageImage == null) throw Exception('Unable to render first page of PDF.');

    final tempDir = await getTemporaryDirectory();
    final renderedFile = File('${tempDir.path}/pdf_rx_${DateTime.now().millisecondsSinceEpoch}.jpg');
    await renderedFile.writeAsBytes(pageImage.bytes);
    return renderedFile;
  }

  /// Validates file size (max 10 MB)
  Future<File> _validateAndConvert(File file) async {
    final int size = await file.length();
    if (size > 10 * 1024 * 1024) {
      throw Exception('File size exceeds the 10 MB maximum limit.');
    }
    return file;
  }

  /// Compresses image to max 1600px long edge to optimize OCR and network upload
  Future<File> compressPrescriptionImage(File sourceFile) async {
    final tempDir = await getTemporaryDirectory();
    final targetPath =
        '${tempDir.path}/rx_comp_${DateTime.now().millisecondsSinceEpoch}.jpg';

    final XFile? compressed = await FlutterImageCompress.compressAndGetFile(
      sourceFile.absolute.path,
      targetPath,
      minWidth: 1600,
      minHeight: 1600,
      quality: 85,
      format: CompressFormat.jpeg,
    );

    return compressed != null ? File(compressed.path) : sourceFile;
  }

  /// Performs quality diagnostic check for blur, darkness, and resolution
  Future<QualityCheckResult> inspectQuality(File file) async {
    return QualityCheckResult.analyzeFile(file);
  }

  // --- PROFILES MANAGEMENT ("Me" default) ---

  /// Fetches patient profiles under this user account
  Future<List<PatientProfile>> getPatientProfiles() async {
    final uid = _currentUserId;
    final snapshot = await _firestore
        .collection('users')
        .doc(uid)
        .collection('profiles')
        .get();

    if (snapshot.docs.isEmpty) {
      // Create default "Me" profile on first use
      final defaultProfile = PatientProfile.defaultSelf(uid);
      await _firestore
          .collection('users')
          .doc(uid)
          .collection('profiles')
          .doc(defaultProfile.id)
          .set(defaultProfile.toMap());
      return [defaultProfile];
    }

    return snapshot.docs
        .map((d) => PatientProfile.fromMap(d.data(), d.id))
        .toList();
  }

  /// Creates a new patient profile (e.g. "Mother", "Father", "Child")
  Future<PatientProfile> createPatientProfile(String name, String relation) async {
    final uid = _currentUserId;
    final docRef = _firestore
        .collection('users')
        .doc(uid)
        .collection('profiles')
        .doc();

    final profile = PatientProfile(
      id: docRef.id,
      name: name.trim(),
      relation: relation,
      isDefault: false,
      createdAt: DateTime.now(),
    );

    await docRef.set(profile.toMap());
    return profile;
  }

  // --- STORAGE & FIRESTORE UPLOAD ---

  /// Saves local copy in app-private storage, uploads to Firebase Storage
  /// (`users/{uid}/prescriptions/{rxId}.jpg`), and registers Firestore doc.
  Future<PrescriptionModel> saveAndUploadPrescription({
    required File imageFile,
    required String profileId,
    required String profileName,
    String? doctorName,
    required DateTime prescriptionDate,
    required Function(double progress) onProgress,
  }) async {
    final uid = _currentUserId;
    final String rxId = 'rx_${DateTime.now().millisecondsSinceEpoch}';

    // 1. Copy to app-private directory for guaranteed offline access
    final appDir = await getApplicationDocumentsDirectory();
    final localFolder = Directory('${appDir.path}/prescriptions/$uid');
    if (!await localFolder.exists()) {
      await localFolder.create(recursive: true);
    }
    final localCopy = await imageFile.copy('${localFolder.path}/$rxId.jpg');
    final int fileSize = await localCopy.length();

    final storagePath = 'users/$uid/prescriptions/$rxId.jpg';
    String? downloadUrl;
    bool isOffline = false;

    // 2. Upload to Firebase Storage with progress tracking
    try {
      final storageRef = _storage.ref().child(storagePath);
      final uploadTask = storageRef.putFile(
        localCopy,
        SettableMetadata(
          contentType: 'image/jpeg',
          customMetadata: {
            'userId': uid,
            'rxId': rxId,
            'profileId': profileId,
          },
        ),
      );

      uploadTask.snapshotEvents.listen((TaskSnapshot snapshot) {
        if (snapshot.totalBytes > 0) {
          final progress = snapshot.bytesTransferred / snapshot.totalBytes;
          onProgress(progress);
        }
      });

      final snapshot = await uploadTask;
      downloadUrl = await snapshot.ref.getDownloadURL();
      onProgress(1.0);
    } catch (_) {
      // Offline fallback: flag for later synchronization
      isOffline = true;
      onProgress(1.0);
    }

    // 3. Create Cloud Firestore document under /users/{uid}/prescriptions/{rxId}
    final model = PrescriptionModel(
      id: rxId,
      userId: uid,
      profileId: profileId,
      profileName: profileName,
      doctorName: doctorName?.trim(),
      prescriptionDate: prescriptionDate,
      localFilePath: localCopy.path,
      storageUrl: downloadUrl,
      storagePath: storagePath,
      status: PrescriptionStatus.uploaded,
      fileSizeBytes: fileSize,
      isOfflineQueued: isOffline,
      uploadProgress: 1.0,
      createdAt: DateTime.now(),
    );

    await _firestore
        .collection('users')
        .doc(uid)
        .collection('prescriptions')
        .doc(rxId)
        .set(model.toMap());

    return model;
  }

  // --- PRESCRIPTION LIST & DELETION ---

  /// Real-time stream of prescriptions for the current patient
  Stream<List<PrescriptionModel>> streamPrescriptions() {
    final uid = _currentUserId;
    return _firestore
        .collection('users')
        .doc(uid)
        .collection('prescriptions')
        .orderBy('prescriptionDate', descending: true)
        .snapshots()
        .map((snap) => snap.docs
            .map((doc) => PrescriptionModel.fromMap(doc.data(), doc.id))
            .toList());
  }

  /// Permanently erases prescription image from Storage and doc from Firestore
  Future<void> deletePrescription(String rxId, String storagePath) async {
    final uid = _currentUserId;

    // 1. Delete from Firestore
    await _firestore
        .collection('users')
        .doc(uid)
        .collection('prescriptions')
        .doc(rxId)
        .delete();

    // 2. Delete from Firebase Storage if present
    try {
      if (storagePath.isNotEmpty) {
        await _storage.ref(storagePath).delete();
      }
    } catch (_) {
      // Ignore if already deleted
    }

    // 3. Delete local copy
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final localFile = File('${appDir.path}/prescriptions/$uid/$rxId.jpg');
      if (await localFile.exists()) {
        await localFile.delete();
      }
    } catch (_) {}
  }
}
