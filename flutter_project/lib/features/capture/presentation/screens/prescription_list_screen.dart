import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/ui/medical_disclaimer_footer.dart';
import '../capture_providers.dart';
import '../../domain/prescription_model.dart';

/// Screen listing all captured prescriptions with thumbnails, status chips,
/// attribution profiles, and secure deletion dialog.
class PrescriptionListScreen extends ConsumerWidget {
  const PrescriptionListScreen({super.key});

  void _showDeleteDialog(
      BuildContext context, WidgetRef ref, PrescriptionModel rx) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: const RoundedRectangleBorder(
          borderRadius: AppTheme.defaultBorderRadius,
        ),
        title: const Text('Delete Prescription?'),
        content: const Text(
          'Under DPDP Act 2023, deleting this prescription will permanently erase the scanned image from cloud storage and remove all associated medication reminders.',
          style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.of(ctx).pop();
              final repo = ref.read(prescriptionRepositoryProvider);
              await repo.deletePrescription(rx.id, rx.storagePath);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Prescription deleted permanently.'),
                  ),
                );
              }
            },
            child: const Text('Delete Permanently'),
          ),
        ],
      ),
    );
  }

  Color _getStatusBgColor(PrescriptionStatus status) {
    switch (status) {
      case PrescriptionStatus.confirmed:
        return AppColors.accentGreenLight;
      case PrescriptionStatus.needsReview:
        return AppColors.warningLight;
      case PrescriptionStatus.uploaded:
      default:
        return AppColors.primaryBlueLight;
    }
  }

  Color _getStatusTextColor(PrescriptionStatus status) {
    switch (status) {
      case PrescriptionStatus.confirmed:
        return AppColors.accentGreenDark;
      case PrescriptionStatus.needsReview:
        return AppColors.warning;
      case PrescriptionStatus.uploaded:
      default:
        return AppColors.primaryBlueDark;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prescriptionsAsync = ref.watch(prescriptionsStreamProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Prescriptions'),
        actions: [
          IconButton(
            tooltip: 'Scan New',
            icon: const Icon(Icons.add_a_photo_rounded),
            onPressed: () => context.push('/capture'),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: prescriptionsAsync.when(
                data: (prescriptions) {
                  if (prescriptions.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                color: AppColors.primaryBlueLight,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.receipt_long_rounded,
                                size: 56,
                                color: AppColors.primaryBlue,
                              ),
                            ),
                            const SizedBox(height: 20),
                            const Text(
                              'No Prescriptions Yet',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Photograph doctor prescriptions or import PDFs to translate medicines into your language.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14,
                                color: AppColors.textSecondary,
                                height: 1.4,
                              ),
                            ),
                            const SizedBox(height: 24),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.accentGreen,
                                minimumSize: const Size(220, 50),
                              ),
                              onPressed: () => context.push('/capture'),
                              icon: const Icon(Icons.camera_alt_rounded),
                              label: const Text('Scan First Prescription'),
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: prescriptions.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final rx = prescriptions[index];
                      final fileExists = File(rx.localFilePath).existsSync();

                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: AppTheme.defaultBorderRadius,
                          border: Border.all(color: AppColors.border),
                          boxShadow: const [AppColors.softShadow],
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Thumbnail Preview
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: AppColors.divider,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.border),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: fileExists
                                  ? Image.file(
                                      File(rx.localFilePath),
                                      fit: BoxFit.cover,
                                    )
                                  : const Icon(
                                      Icons.receipt_long_rounded,
                                      color: AppColors.textSecondary,
                                      size: 32,
                                    ),
                            ),
                            const SizedBox(width: 14),

                            // Content Details
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          rx.doctorName ?? 'Doctor Prescription',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                      ),
                                      // Status Chip
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 3,
                                        ),
                                        decoration: BoxDecoration(
                                          color: _getStatusBgColor(rx.status),
                                          borderRadius:
                                              BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          rx.status.label,
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color:
                                                _getStatusTextColor(rx.status),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'For: ${rx.profileName} • ${rx.prescriptionDate.day}/${rx.prescriptionDate.month}/${rx.prescriptionDate.year}',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  if (rx.isOfflineQueued)
                                    Row(
                                      children: [
                                        const Icon(Icons.cloud_queue_rounded,
                                            size: 14, color: AppColors.warning),
                                        const SizedBox(width: 4),
                                        Text(
                                          'Saved locally. Will upload online.',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.warning,
                                          ),
                                        ),
                                      ],
                                    ),
                                ],
                              ),
                            ),

                            // Delete button
                            IconButton(
                              icon: const Icon(
                                Icons.delete_outline_rounded,
                                color: AppColors.error,
                                size: 20,
                              ),
                              onPressed: () =>
                                  _showDeleteDialog(context, ref, rx),
                            ),
                          ],
                        ),
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text('Error loading prescriptions: $e'),
                ),
              ),
            ),

            // Mandatory medical disclaimer footer
            const MedicalDisclaimerFooter(),
          ],
        ),
      ),
    );
  }
}
