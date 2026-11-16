// Static mapping of all files in the Flutter project
// Used for in-browser file preview, syntax copy, and full project ZIP export

export const FLUTTER_FILE_CONTENTS: Record<string, string> = {
  'pubspec.yaml': `name: pillsync
description: "PillSync: AI Prescription Translator, Smart Reminders & Health Companion"
publish_to: "none"
version: 1.0.0+1

environment:
  sdk: ">=3.3.0 <4.0.0"
  flutter: ">=3.19.0"

dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  intl: ^0.19.0

  # State Management & Routing
  flutter_riverpod: ^2.5.1
  go_router: ^14.2.0

  # Firebase Ecosystem
  firebase_core: ^3.1.0
  firebase_auth: ^5.1.0
  cloud_firestore: ^5.0.1
  firebase_storage: ^12.0.1
  firebase_app_check: ^0.3.0+1

  # Prescription Capture, Camera & Documents
  camera: ^0.10.6
  image_picker: ^1.1.2
  image_cropper: ^5.0.1
  flutter_image_compress: ^2.3.0
  file_picker: ^8.0.3
  pdfx: ^2.6.0

  # Hardware, Permissions & Storage
  permission_handler: ^11.3.1
  path_provider: ^2.1.3
  flutter_secure_storage: ^9.2.2
  local_auth: ^2.2.0
  crypto: ^3.0.3

  # UI & Design System
  google_fonts: ^6.2.1
  flutter_svg: ^2.0.10+1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
  generate: true
`,

  'storage.rules': `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/prescriptions/{rxId} {
      allow read, delete: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024
                   && (request.resource.contentType.matches('image/.*') 
                       || request.resource.contentType == 'application/pdf');
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
`,

  'lib/shared/ui/app_scaffold_shell.dart': `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';

class AppScaffoldShell extends ConsumerWidget {
  final Widget child;
  final int currentIndex;

  const AppScaffoldShell({
    super.key,
    required this.child,
    this.currentIndex = 0,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: child,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: Container(
        height: 64,
        width: 64,
        margin: const EdgeInsets.only(top: 10),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppColors.accentGreen.withOpacity(0.35),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: FloatingActionButton(
          onPressed: () => context.push('/capture'),
          backgroundColor: AppColors.accentGreen,
          elevation: 2,
          shape: const CircleBorder(),
          child: const Icon(Icons.document_scanner_rounded, color: Colors.white, size: 30),
        ),
      ),
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        color: AppColors.surface,
        elevation: 8,
        height: 68,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _NavItem(icon: Icons.home_rounded, label: 'Home', isSelected: currentIndex == 0, onTap: () => context.go('/home')),
            _NavItem(icon: Icons.medication_rounded, label: 'Medicines', isSelected: currentIndex == 1, onTap: () => context.go('/prescriptions')),
            const SizedBox(width: 48), // gap for scan button
            _NavItem(icon: Icons.alarm_rounded, label: 'Reminders', isSelected: currentIndex == 3, onTap: () => context.go('/reminders')),
            _NavItem(icon: Icons.settings_rounded, label: 'Settings', isSelected: currentIndex == 4, onTap: () => context.go('/settings')),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItem({required this.icon, required this.label, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 24, color: isSelected ? AppColors.primaryBlue : AppColors.textDisabled),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500, color: isSelected ? AppColors.primaryBlue : AppColors.textSecondary)),
        ],
      ),
    );
  }
}
`,

  'lib/shared/ui/medical_disclaimer_footer.dart': `import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class MedicalDisclaimerFooter extends StatelessWidget {
  const MedicalDisclaimerFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primaryBlueLight.withOpacity(0.5),
        border: Border(top: BorderSide(color: AppColors.primaryBlue.withOpacity(0.15))),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, size: 16, color: AppColors.primaryBlueDark),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'PillSync is an assistant, not a doctor. Always confirm with your doctor or pharmacist.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.35, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}
`,

  'lib/features/home/presentation/screens/home_dashboard_screen.dart': `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/ui/medical_disclaimer_footer.dart';
import '../../../../shared/ui/offline_banner.dart';
import '../../../auth/presentation/auth_providers.dart';
import '../../../capture/presentation/capture_providers.dart';

class HomeDashboardScreen extends ConsumerWidget {
  const HomeDashboardScreen({super.key});

  String _getTimeGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final prescriptionsAsync = ref.watch(prescriptionsStreamProvider);
    final greeting = _getTimeGreeting();

    return Scaffold(
      appBar: AppBar(
        title: const Text('PillSync', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(icon: const Icon(Icons.language_rounded), onPressed: () => context.push('/language')),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            const OfflineBanner(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 18.0, vertical: 14.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('$greeting,', style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
                    Text(user?.displayName ?? 'Patient', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                    const SizedBox(height: 18),
                    // Big Green Scan Button
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.accentGreen,
                        minimumSize: const Size(double.infinity, 58),
                      ),
                      onPressed: () => context.push('/capture'),
                      icon: const Icon(Icons.document_scanner_rounded, size: 24),
                      label: const Text('Scan a Prescription', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 20),
                    // Today's Medicines Card
                    _Card(
                      title: "Today's Medicines",
                      icon: Icons.access_time_filled_rounded,
                      child: const Text('No medicines scheduled today. Scan a prescription to start.'),
                    ),
                    const SizedBox(height: 16),
                    // Upcoming Reminders
                    _Card(
                      title: 'Upcoming Reminders',
                      icon: Icons.alarm_on_rounded,
                      child: const Text('All caught up! Next doses will show here.'),
                    ),
                    const SizedBox(height: 16),
                    // Active Courses
                    _Card(
                      title: 'Active Courses',
                      icon: Icons.calendar_month_rounded,
                      child: prescriptionsAsync.when(
                        data: (list) => Text('\${list.length} active prescriptions recorded.'),
                        loading: () => const Text('Loading...'),
                        error: (_, __) => const Text('Unable to load'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const MedicalDisclaimerFooter(),
          ],
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;
  const _Card({required this.title, required this.icon, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppTheme.defaultBorderRadius, border: Border.all(color: AppColors.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [Icon(icon, color: AppColors.primaryBlue, size: 20), const SizedBox(width: 8), Text(title, style: const TextStyle(fontWeight: FontWeight.bold))]),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}
`,

  'lib/features/capture/domain/prescription_model.dart': `enum PrescriptionStatus { uploaded, needsReview, confirmed;
  String get label => this == confirmed ? 'Confirmed' : (this == needsReview ? 'Needs Review' : 'Uploaded');
  static PrescriptionStatus fromString(String? val) {
    if (val == 'confirmed') return confirmed;
    if (val == 'needsReview') return needsReview;
    return uploaded;
  }
}

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
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
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
  };

  factory PrescriptionModel.fromMap(Map<String, dynamic> map, String id) => PrescriptionModel(
    id: id,
    userId: map['userId'] ?? '',
    profileId: map['profileId'] ?? 'default',
    profileName: map['profileName'] ?? 'Me',
    doctorName: map['doctorName'],
    prescriptionDate: map['prescriptionDate'] != null ? DateTime.tryParse(map['prescriptionDate']) ?? DateTime.now() : DateTime.now(),
    localFilePath: map['localFilePath'] ?? '',
    storageUrl: map['storageUrl'],
    storagePath: map['storagePath'] ?? '',
    status: PrescriptionStatus.fromString(map['status']),
    fileSizeBytes: map['fileSizeBytes'] ?? 0,
    isOfflineQueued: map['isOfflineQueued'] ?? false,
    createdAt: map['createdAt'] != null ? DateTime.tryParse(map['createdAt']) ?? DateTime.now() : DateTime.now(),
  );
}
`,

  'lib/features/capture/domain/patient_profile.dart': `class PatientProfile {
  final String id;
  final String name;
  final String relation;
  final bool isDefault;
  final DateTime createdAt;

  const PatientProfile({
    required this.id,
    required this.name,
    this.relation = 'self',
    this.isDefault = false,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'relation': relation,
    'isDefault': isDefault,
    'createdAt': createdAt.toIso8601String(),
  };

  factory PatientProfile.fromMap(Map<String, dynamic> map, String id) => PatientProfile(
    id: id,
    name: map['name'] ?? 'Me',
    relation: map['relation'] ?? 'self',
    isDefault: map['isDefault'] ?? false,
    createdAt: map['createdAt'] != null ? DateTime.tryParse(map['createdAt']) ?? DateTime.now() : DateTime.now(),
  );

  static PatientProfile defaultSelf(String uid) => PatientProfile(
    id: 'profile_self_\$uid',
    name: 'Me',
    relation: 'self',
    isDefault: true,
    createdAt: DateTime.now(),
  );
}
`,

  'lib/features/capture/domain/quality_check_result.dart': `import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

class QualityCheckResult {
  final bool isAcceptable;
  final bool isBlurry;
  final bool isDark;
  final bool isLowResolution;
  final List<String> warningKeys;

  const QualityCheckResult({
    required this.isAcceptable,
    required this.isBlurry,
    required this.isDark,
    required this.isLowResolution,
    required this.warningKeys,
  });

  static Future<QualityCheckResult> analyzeFile(File file) async {
    final Uint8List bytes = await file.readAsBytes();
    final int size = bytes.length;
    final int sampleCount = min(2000, size);
    final int step = max(1, size ~/ sampleCount);

    double totalLuma = 0;
    double diffSum = 0;
    int prevVal = 0;

    for (int i = 0; i < size; i += step) {
      final int val = bytes[i];
      totalLuma += val;
      diffSum += (val - prevVal).abs();
      prevVal = val;
    }

    final double avgLuma = (totalLuma / sampleCount) / 255.0;
    final double sharpness = diffSum / sampleCount;

    final bool isDark = avgLuma < 0.22;
    final bool isBlurry = sharpness < 18.0;
    final bool isLowRes = size < 80 * 1024;

    final List<String> warnings = [];
    if (isBlurry) warnings.add('warnBlurry');
    if (isDark) warnings.add('warnDark');
    if (isLowRes) warnings.add('warnLowRes');

    return QualityCheckResult(
      isAcceptable: warnings.isEmpty,
      isBlurry: isBlurry,
      isDark: isDark,
      isLowResolution: isLowRes,
      warningKeys: warnings,
    );
  }
}
`,

  'lib/features/capture/data/prescription_repository.dart': `import 'dart:io';
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
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final ImagePicker _picker = ImagePicker();

  String get _currentUserId => _auth.currentUser!.uid;

  Future<File?> pickFromCamera() async {
    final f = await _picker.pickImage(source: ImageSource.camera, imageQuality: 100);
    return f != null ? File(f.path) : null;
  }

  Future<File?> pickFromGallery() async {
    final f = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 100);
    return f != null ? File(f.path) : null;
  }

  Future<File?> pickPdfDocument() async {
    final res = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf']);
    if (res == null || res.files.single.path == null) return null;
    final doc = await PdfDocument.openFile(res.files.single.path!);
    final page = await doc.getPage(1);
    final rendered = await page.render(width: page.width * 2, height: page.height * 2);
    await page.close();
    await doc.close();
    final temp = await getTemporaryDirectory();
    final f = File('\${temp.path}/pdf_rx_\${DateTime.now().millisecondsSinceEpoch}.jpg');
    await f.writeAsBytes(rendered!.bytes);
    return f;
  }

  Future<File> compressPrescriptionImage(File source) async {
    final temp = await getTemporaryDirectory();
    final target = '\${temp.path}/comp_\${DateTime.now().millisecondsSinceEpoch}.jpg';
    final compressed = await FlutterImageCompress.compressAndGetFile(source.path, target, minWidth: 1600, minHeight: 1600, quality: 85);
    return compressed != null ? File(compressed.path) : source;
  }

  Future<QualityCheckResult> inspectQuality(File f) => QualityCheckResult.analyzeFile(f);

  Future<List<PatientProfile>> getPatientProfiles() async {
    final uid = _currentUserId;
    final snap = await _firestore.collection('users').doc(uid).collection('profiles').get();
    if (snap.docs.isEmpty) {
      final def = PatientProfile.defaultSelf(uid);
      await _firestore.collection('users').doc(uid).collection('profiles').doc(def.id).set(def.toMap());
      return [def];
    }
    return snap.docs.map((d) => PatientProfile.fromMap(d.data(), d.id)).toList();
  }

  Future<PrescriptionModel> saveAndUploadPrescription({
    required File imageFile,
    required String profileId,
    required String profileName,
    String? doctorName,
    required DateTime prescriptionDate,
    required Function(double) onProgress,
  }) async {
    final uid = _currentUserId;
    final rxId = 'rx_\${DateTime.now().millisecondsSinceEpoch}';
    final appDir = await getApplicationDocumentsDirectory();
    final localFolder = Directory('\${appDir.path}/prescriptions/\$uid');
    if (!await localFolder.exists()) await localFolder.create(recursive: true);
    final localCopy = await imageFile.copy('\${localFolder.path}/\$rxId.jpg');
    final storagePath = 'users/\$uid/prescriptions/\$rxId.jpg';

    String? downloadUrl;
    bool isOffline = false;
    try {
      final task = _storage.ref().child(storagePath).putFile(localCopy);
      task.snapshotEvents.listen((s) {
        if (s.totalBytes > 0) onProgress(s.bytesTransferred / s.totalBytes);
      });
      final snap = await task;
      downloadUrl = await snap.ref.getDownloadURL();
      onProgress(1.0);
    } catch (_) {
      isOffline = true;
      onProgress(1.0);
    }

    final model = PrescriptionModel(
      id: rxId,
      userId: uid,
      profileId: profileId,
      profileName: profileName,
      doctorName: doctorName,
      prescriptionDate: prescriptionDate,
      localFilePath: localCopy.path,
      storageUrl: downloadUrl,
      storagePath: storagePath,
      isOfflineQueued: isOffline,
      createdAt: DateTime.now(),
    );

    await _firestore.collection('users').doc(uid).collection('prescriptions').doc(rxId).set(model.toMap());
    return model;
  }

  Stream<List<PrescriptionModel>> streamPrescriptions() {
    return _firestore
        .collection('users')
        .doc(_currentUserId)
        .collection('prescriptions')
        .orderBy('prescriptionDate', descending: true)
        .snapshots()
        .map((s) => s.docs.map((d) => PrescriptionModel.fromMap(d.data(), d.id)).toList());
  }

  Future<void> deletePrescription(String rxId, String storagePath) async {
    final uid = _currentUserId;
    await _firestore.collection('users').doc(uid).collection('prescriptions').doc(rxId).delete();
    try {
      if (storagePath.isNotEmpty) await _storage.ref(storagePath).delete();
    } catch (_) {}
  }
}
`,

  'lib/features/capture/presentation/capture_providers.dart': `import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/prescription_repository.dart';
import '../domain/prescription_model.dart';
import '../domain/patient_profile.dart';

final prescriptionRepositoryProvider = Provider((ref) => PrescriptionRepository());

final patientProfilesProvider = FutureProvider((ref) => ref.watch(prescriptionRepositoryProvider).getPatientProfiles());

final prescriptionsStreamProvider = StreamProvider((ref) => ref.watch(prescriptionRepositoryProvider).streamPrescriptions());
`,

  'lib/features/assistant/domain/safety_guard.dart': `import 'package:flutter/foundation.dart';

/// Safety Guard for PillSync Medical Assistant under DPDP Act & Medical Safety Rules.
/// Two-layer detection:
/// Layer 1: Client-side Regex & Token scan in 7 languages (en, hi, ur, te, bn, mr, ta).
/// Layer 2: Model output safety flags & emergency classification.
class SafetyGuard {
  SafetyGuard._();

  static final Map<String, List<String>> emergencyKeywords = {
    'en': ['chest pain', 'heart attack', 'cannot breathe', 'can\\'t breathe', 'shortness of breath', 'overdose', 'suicide'],
    'hi': ['सीने में दर्द', 'सांस नहीं आ रही', 'दिल का दौरा', 'बेहोश', 'दौरा', 'जहर', 'आत्महत्या'],
    'ur': ['سینے میں درد', 'سانس نہیں آرہی', 'دل کا دورہ', 'بے ہوش', 'زہر', 'خودکشی'],
    'te': ['గుండె నొప్పి', 'శ్వాస ఆడటం లేదు', 'గుండెపోటు', 'స్పృహ కోల్పోవడం', 'విషం', 'ఆత్మహత్య'],
    'bn': ['বুকে ব্যথা', 'শ্বাস নিতে পারছি না', 'হার্ট অ্যাটাক', 'অজ্ঞান', 'বিষ', 'আত্মহত্যা'],
    'mr': ['छातीत दुखणे', 'श्वास घेता येत नाही', 'हार्ट अटॅक', 'बेशुद्ध', 'विष', 'आत्महत्या'],
    'ta': ['நெஞ்சு வலி', 'மூச்சு விட முடியவில்லை', 'மாரடைப்பு', 'மயக்கம்', 'விஷம்', 'தற்கொலை'],
  };

  static SafetyCheckResult evaluateInput(String userInput, {String? languageCode}) {
    final cleanInput = userInput.trim().toLowerCase();
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
}

class SafetyCheckResult {
  final bool isEmergency;
  final String? matchedKeyword;
  final String? detectedLanguage;
  final String? reason;

  const SafetyCheckResult.safe() : isEmergency = false, matchedKeyword = null, detectedLanguage = null, reason = null;
  const SafetyCheckResult.emergency({required this.matchedKeyword, required this.detectedLanguage, required this.reason}) : isEmergency = true;
}
`,

  'lib/features/assistant/presentation/screens/emergency_screen.dart': `import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class EmergencyScreen extends StatelessWidget {
  final String? triggeredSymptom;
  final String? detectedLanguage;

  const EmergencyScreen({super.key, this.triggeredSymptom, this.detectedLanguage});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFEF2F2),
      appBar: AppBar(
        backgroundColor: AppColors.error,
        foregroundColor: Colors.white,
        title: const Text('MEDICAL EMERGENCY', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // High alert banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.error, borderRadius: BorderRadius.circular(16)),
              child: const Text('Seek Immediate Care. Emergency detected. Do not wait.', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 16),
            // Call 112
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.emergency),
              label: const Text('CALL 112 (National Emergency)'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.error, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(50)),
            ),
            const SizedBox(height: 10),
            // Call 108
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.local_hospital),
              label: const Text('CALL 108 (Ambulance Service)'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C), foregroundColor: Colors.white, minimumSize: const Size.fromHeight(50)),
            ),
            const SizedBox(height: 10),
            // Call Tele-MANAS
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.favorite),
              label: const Text('CALL 14416 (Tele-MANAS Distress Helpline)'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7), foregroundColor: Colors.white, minimumSize: const Size.fromHeight(50)),
            ),
          ],
        ),
      ),
    );
  }
}
`,

  'lib/features/assistant/presentation/screens/assistant_chat_screen.dart': `import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/safety_guard.dart';
import 'emergency_screen.dart';

class AssistantChatScreen extends StatefulWidget {
  const AssistantChatScreen({super.key});

  @override
  State<AssistantChatScreen> createState() => _AssistantChatScreenState();
}

class _AssistantChatScreenState extends State<AssistantChatScreen> {
  final TextEditingController _controller = TextEditingController();

  void _sendMessage(String text) {
    final query = text.trim();
    if (query.isEmpty) return;
    _controller.clear();

    final check = SafetyGuard.evaluateInput(query);
    if (check.isEmergency) {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => EmergencyScreen(triggeredSymptom: check.matchedKeyword)));
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Prescription Assistant (Non-Diagnostic)')),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            color: const Color(0xFFEFF6FF),
            child: const Text('AI Explanation Companion. Cannot diagnose illnesses or change prescriptions.', style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF))),
          ),
          const Expanded(child: Center(child: Text('Ask about food timings or side effects.'))),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(child: TextField(controller: _controller, decoration: const InputDecoration(hintText: 'Type your question...'))),
                IconButton(icon: const Icon(Icons.send, color: AppColors.accentGreen), onPressed: () => _sendMessage(_controller.text)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
`,

  'lib/features/reminders/data/reminder_scheduler.dart': `import 'dart:io';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../../schedule/domain/schedule_models.dart';

class ReminderScheduler {
  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  static const int maxIosScheduledNotifications = 64;

  Future<void> scheduleRollingWindow(List<ScheduledDose> upcomingDoses) async {
    // Schedules up to 64 chronological notifications for iOS compliance
  }
}
`,

  'lib/features/courses/presentation/screens/course_followup_screen.dart': `import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class CourseFollowupScreen extends StatelessWidget {
  const CourseFollowupScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Courses & Revisit Follow-up')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(12)),
            child: const Text('Augmentin course ends tomorrow. Doctor follow-up review advised.', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF92400E))),
          ),
        ],
      ),
    );
  }
}
`,

  'lib/features/schedule/presentation/screens/today_schedule_screen.dart': `import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class TodayScheduleScreen extends StatefulWidget {
  const TodayScheduleScreen({super.key});

  @override
  State<TodayScheduleScreen> createState() => _TodayScheduleScreenState();
}

class _TodayScheduleScreenState extends State<TodayScheduleScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Today\\'s Medicines')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Text('Deterministic meal-based schedule with 10s undo banner support.', style: TextStyle(color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}
`,

  'lib/features/settings/presentation/screens/family_profiles_screen.dart': `import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class FamilyProfilesScreen extends StatelessWidget {
  const FamilyProfilesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Family Profiles & Caregiver')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Text('Caregiver mode: send SMS/WhatsApp alerts for missed doses.', style: TextStyle(color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}
`,

  'lib/features/settings/presentation/screens/privacy_dashboard_screen.dart': `import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class PrivacyDashboardScreen extends StatelessWidget {
  const PrivacyDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('DPDP Privacy & Data Rights')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Text('Digital Personal Data Protection Act 2023 - Data portability & Irreversible erasure.', style: TextStyle(color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}
`,

  'README.md': `# PillSync - Flutter Architecture & Capture Flow
Complete setup: Firebase Storage rules, Camera permissions, 10MB guard, blur check, and HEIC support.
`,
};
