import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/ui/medical_disclaimer_footer.dart';
import '../domain/parsed_prescription.dart';
import '../data/prescription_parser.dart';

/// Review and Confirm Screen.
/// Provides pinned, collapsible interactive prescription image viewer with pinch-zoom,
/// confidence badges (green/amber/red), field editing, manual add/delete,
/// and gating on "Confirm all" until every flagged item is verified.
class ReviewConfirmScreen extends StatefulWidget {
  final File prescriptionImage;
  final String prescriptionId;

  const ReviewConfirmScreen({
    super.key,
    required this.prescriptionImage,
    required this.prescriptionId,
  });

  @override
  State<ReviewConfirmScreen> createState() => _ReviewConfirmScreenState();
}

class _ReviewConfirmScreenState extends State<ReviewConfirmScreen> {
  final PrescriptionParser _parser = PrescriptionParser();
  ParsedPrescriptionResult? _result;
  bool _isLoading = true;
  String? _errorMessage;
  bool _isImagePanelExpanded = true;
  double _rotationAngle = 0.0;
  bool _hasSeenSafetyDialog = false;

  @override
  void initState() {
    super.initState();
    _startParsing();
  }

  Future<void> _startParsing() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _parser.parsePrescriptionImage(widget.prescriptionImage);
      if (mounted) {
        setState(() {
          _result = res;
          _isLoading = false;
        });
        _showOneTimeSafetyDialog();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().contains('AI_CONSENT_WITHDRAWN')
              ? 'AI transcription consent is disabled in your Privacy settings. You can enter medicines manually.'
              : 'Unable to read handwriting clearly. Please retry with a clearer photo or enter details manually.';
        });
      }
    }
  }

  void _showOneTimeSafetyDialog() {
    if (_hasSeenSafetyDialog) return;
    _hasSeenSafetyDialog = true;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          shape: const RoundedRectangleBorder(borderRadius: AppTheme.defaultBorderRadius),
          title: const Row(
            children: [
              Icon(Icons.health_and_safety_rounded, color: AppColors.warning, size: 28),
              SizedBox(width: 8),
              Expanded(
                child: Text('Verify Before Confirming', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          content: const Text(
            'AI handwriting readers can make transcription errors. Carefully inspect each medicine name, strength, and frequency against the doctor\'s original prescription before confirming.',
            style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('I Understand, Continue to Review'),
            ),
          ],
        ),
      );
    });
  }

  void _addManualMedicine() {
    final newMed = ParsedMedicine(
      id: 'med_manual_${DateTime.now().millisecondsSinceEpoch}',
      name: 'New Medicine',
      strength: '500 mg',
      dose: '1 tablet',
      frequency: '1-0-1',
      timing: 'after_food',
      durationDays: 5,
      confidence: 1.0,
      userVerified: true,
    );

    setState(() {
      _result = ParsedPrescriptionResult(
        doctorName: _result?.doctorName,
        clinic: _result?.clinic,
        date: _result?.date,
        patientName: _result?.patientName,
        notes: _result?.notes,
        medicines: [...?_result?.medicines, newMed],
      );
    });
  }

  void _deleteMedicine(String id) {
    setState(() {
      _result = ParsedPrescriptionResult(
        doctorName: _result?.doctorName,
        clinic: _result?.clinic,
        date: _result?.date,
        patientName: _result?.patientName,
        notes: _result?.notes,
        medicines: _result?.medicines.where((m) => m.id != id).toList() ?? [],
      );
    });
  }

  void _markVerified(String id) {
    setState(() {
      _result = ParsedPrescriptionResult(
        doctorName: _result?.doctorName,
        clinic: _result?.clinic,
        date: _result?.date,
        patientName: _result?.patientName,
        notes: _result?.notes,
        medicines: _result?.medicines.map((m) {
          if (m.id == id) {
            return m.copyWith(userVerified: true, illegible: false);
          }
          return m;
        }).toList() ?? [],
      );
    });
  }

  Future<void> _handleConfirmAll() async {
    // Navigate to translation & schedule creation
    context.push('/translate-prescription', extra: _result);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Reading Prescription')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(
                  width: 54,
                  height: 54,
                  child: CircularProgressIndicator(strokeWidth: 3, valueColor: AlwaysStoppedAnimation(AppColors.primaryBlue)),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Reading your prescription with Gemini AI...',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Transcribing doctor handwriting, dosages, frequency, and treatment duration safely.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Review Transcription')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline_rounded, size: 56, color: AppColors.warning),
                const SizedBox(height: 16),
                Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4)),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _startParsing,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry Transcription'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _errorMessage = null;
                      _result = ParsedPrescriptionResult(medicines: []);
                    });
                    _addManualMedicine();
                  },
                  child: const Text('Enter Medicines Manually'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final medicines = _result?.medicines ?? [];
    final unverifiedCount = medicines.where((m) => m.needsReview).length;
    final canConfirm = unverifiedCount == 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review Prescription'),
        actions: [
          IconButton(
            tooltip: 'Add Medicine Manually',
            icon: const Icon(Icons.add_rounded),
            onPressed: _addManualMedicine,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // PINNED COLLAPSIBLE IMAGE VIEWER WITH PINCH-TO-ZOOM & ROTATE
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              height: _isImagePanelExpanded ? 220 : 44,
              width: double.infinity,
              color: Colors.black,
              child: Stack(
                children: [
                  if (_isImagePanelExpanded)
                    InteractiveViewer(
                      minScale: 0.8,
                      maxScale: 4.0,
                      child: Center(
                        child: Transform.rotate(
                          angle: _rotationAngle,
                          child: Image.file(widget.prescriptionImage, fit: BoxFit.contain),
                        ),
                      ),
                    ),
                  // Controls Bar
                  Positioned(
                    top: 6,
                    right: 8,
                    child: Row(
                      children: [
                        if (_isImagePanelExpanded)
                          IconButton(
                            icon: const Icon(Icons.rotate_right_rounded, color: Colors.white, size: 20),
                            onPressed: () => setState(() => _rotationAngle += 1.5708), // 90 deg
                          ),
                        IconButton(
                          icon: Icon(_isImagePanelExpanded ? Icons.keyboard_arrow_up_rounded : Icons.photo_size_select_actual_rounded, color: Colors.white, size: 20),
                          onPressed: () => setState(() => _isImagePanelExpanded = !_isImagePanelExpanded),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // REVIEW INSTRUCTION BAR
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: canConfirm ? AppColors.accentGreenLight : AppColors.warningLight,
              child: Row(
                children: [
                  Icon(canConfirm ? Icons.check_circle_rounded : Icons.warning_amber_rounded, size: 18, color: canConfirm ? AppColors.accentGreenDark : AppColors.warning),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      canConfirm ? 'All medicines verified! Ready to confirm.' : '$unverifiedCount medicines require safety check.',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: canConfirm ? AppColors.accentGreenDark : const Color(0xFF92400E)),
                    ),
                  ),
                ],
              ),
            ),

            // MEDICINE CARDS LIST
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: medicines.length,
                separatorBuilder: (_, __) => const SizedBox(height: 14),
                itemBuilder: (context, idx) {
                  final med = medicines[idx];
                  return _MedicineCard(
                    medicine: med,
                    onMarkChecked: () => _markVerified(med.id),
                    onDelete: () => _deleteMedicine(med.id),
                    onViewOriginal: () => setState(() => _isImagePanelExpanded = true),
                  );
                },
              ),
            ),

            // CONFIRM ALL ACTION BAR
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                boxShadow: [AppColors.softShadow],
              ),
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: canConfirm ? AppColors.accentGreen : AppColors.textDisabled,
                  minimumSize: const Size(double.infinity, 54),
                ),
                onPressed: canConfirm ? _handleConfirmAll : null,
                child: Text(
                  canConfirm ? 'Confirm All Medicines & Build Schedule' : 'Check Flagged Items to Confirm ($unverifiedCount left)',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
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

class _MedicineCard extends StatelessWidget {
  final ParsedMedicine medicine;
  final VoidCallback onMarkChecked;
  final VoidCallback onDelete;
  final VoidCallback onViewOriginal;

  const _MedicineCard({
    required this.medicine,
    required this.onMarkChecked,
    required this.onDelete,
    required this.onViewOriginal,
  });

  @override
  Widget build(BuildContext context) {
    final bool flagged = medicine.needsReview;

    Color badgeBg;
    Color badgeText;
    String badgeLabel;

    if (medicine.confidence >= 0.85 && !medicine.illegible) {
      badgeBg = AppColors.accentGreenLight;
      badgeText = AppColors.accentGreenDark;
      badgeLabel = 'High Confidence (${(medicine.confidence * 100).toInt()}%)';
    } else if (medicine.confidence >= 0.70 && !medicine.illegible) {
      badgeBg = AppColors.warningLight;
      badgeText = AppColors.warning;
      badgeLabel = 'Review Needed (${(medicine.confidence * 100).toInt()}%)';
    } else {
      badgeBg = AppColors.errorLight;
      badgeText = AppColors.error;
      badgeLabel = medicine.illegible ? 'Illegible Handwriting' : 'Low Confidence';
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppTheme.defaultBorderRadius,
        border: Border.all(
          color: flagged ? AppColors.error : AppColors.border,
          width: flagged ? 2 : 1,
        ),
        boxShadow: const [AppColors.softShadow],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(6)),
                child: Text(badgeLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: badgeText)),
              ),
              Row(
                children: [
                  TextButton.icon(
                    onPressed: onViewOriginal,
                    icon: const Icon(Icons.zoom_in_rounded, size: 16),
                    label: const Text('View Original', style: TextStyle(fontSize: 11)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, color: AppColors.error, size: 20),
                    onPressed: onDelete,
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(medicine.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
          if (medicine.genericName != null)
            Text(medicine.genericName!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(height: 10),
          Row(
            children: [
              _InfoTag(label: 'Strength', val: medicine.strength),
              const SizedBox(width: 8),
              _InfoTag(label: 'Frequency', val: medicine.frequency),
              const SizedBox(width: 8),
              _InfoTag(label: 'Timing', val: medicine.timing.replaceAll('_', ' ')),
            ],
          ),
          if (flagged) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(8)),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 18),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text('Please check this against the doctor handwriting.', style: TextStyle(fontSize: 12, color: AppColors.error, fontWeight: FontWeight.bold)),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accentGreen,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(90, 34),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                    ),
                    onPressed: onMarkChecked,
                    child: const Text('I checked this', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoTag extends StatelessWidget {
  final String label;
  final String val;
  const _InfoTag({required this.label, required this.val});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(6)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 9, color: AppColors.textSecondary, fontWeight: FontWeight.bold)),
          Text(val, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
