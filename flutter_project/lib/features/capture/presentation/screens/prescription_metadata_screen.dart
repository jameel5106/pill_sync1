import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../capture_providers.dart';
import '../../domain/patient_profile.dart';

/// Screen collecting prescription attribution metadata:
/// "Who is this for?" (defaults to "Me"), Doctor name (optional), and Date picker (default today).
/// Displays live progress bar during Firebase upload and offline queue notice.
class PrescriptionMetadataScreen extends ConsumerStatefulWidget {
  const PrescriptionMetadataScreen({super.key});

  @override
  ConsumerState<PrescriptionMetadataScreen> createState() =>
      _PrescriptionMetadataScreenState();
}

class _PrescriptionMetadataScreenState
    extends ConsumerState<PrescriptionMetadataScreen> {
  final _doctorController = TextEditingController();
  DateTime _selectedDate = DateTime.now();
  String? _selectedProfileId;
  String? _selectedProfileName;

  @override
  void dispose() {
    _doctorController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 7)),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
    }
  }

  void _showAddProfileDialog() {
    final nameController = TextEditingController();
    String relation = 'parent';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          shape: const RoundedRectangleBorder(
            borderRadius: AppTheme.defaultBorderRadius,
          ),
          title: const Text('Add Family Member Profile'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Profile Name',
                  hintText: 'e.g. Mother, Father, Aarav',
                ),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: relation,
                decoration: const InputDecoration(labelText: 'Relationship'),
                items: const [
                  DropdownMenuItem(value: 'parent', child: Text('Parent')),
                  DropdownMenuItem(value: 'spouse', child: Text('Spouse')),
                  DropdownMenuItem(value: 'child', child: Text('Child')),
                  DropdownMenuItem(value: 'other', child: Text('Other')),
                ],
                onChanged: (val) {
                  if (val != null) setModalState(() => relation = val);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final name = nameController.text.trim();
                if (name.isNotEmpty) {
                  final repo = ref.read(prescriptionRepositoryProvider);
                  final newProfile = await repo.createPatientProfile(name, relation);
                  ref.invalidate(patientProfilesProvider);
                  setState(() {
                    _selectedProfileId = newProfile.id;
                    _selectedProfileName = newProfile.name;
                  });
                  if (ctx.mounted) Navigator.of(ctx).pop();
                }
              },
              child: const Text('Add Profile'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleSave() async {
    final profileId = _selectedProfileId ?? 'default_self';
    final profileName = _selectedProfileName ?? 'Me';

    final success = await ref
        .read(captureControllerProvider.notifier)
        .savePrescription(
          profileId: profileId,
          profileName: profileName,
          doctorName: _doctorController.text.trim().isNotEmpty
              ? _doctorController.text.trim()
              : null,
          date: _selectedDate,
        );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Prescription saved securely with status "Uploaded".'),
          backgroundColor: AppColors.accentGreen,
        ),
      );
      context.go('/prescriptions');
    }
  }

  @override
  Widget build(BuildContext context) {
    final profilesAsync = ref.watch(patientProfilesProvider);
    final captureState = ref.watch(captureControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Prescription Details'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 22.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // "Who is this for?" Section
              const Text(
                'Who is this prescription for?',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Attributing prescriptions to specific profiles helps keep dosage schedules organized for the entire family.',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 14),

              profilesAsync.when(
                data: (profiles) {
                  // Default to first profile ("Me") if not yet selected
                  if (_selectedProfileId == null && profiles.isNotEmpty) {
                    _selectedProfileId = profiles.first.id;
                    _selectedProfileName = profiles.first.name;
                  }

                  return Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ...profiles.map((p) {
                        final isSelected = p.id == _selectedProfileId;
                        return ChoiceChip(
                          avatar: Icon(
                            p.name.toLowerCase() == 'me'
                                ? Icons.person_rounded
                                : Icons.family_restroom_rounded,
                            size: 16,
                            color: isSelected ? Colors.white : AppColors.textSecondary,
                          ),
                          label: Text(p.name),
                          selected: isSelected,
                          selectedColor: AppColors.primaryBlue,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                          onSelected: (selected) {
                            if (selected) {
                              setState(() {
                                _selectedProfileId = p.id;
                                _selectedProfileName = p.name;
                              });
                            }
                          },
                        );
                      }),
                      ActionChip(
                        avatar: const Icon(Icons.add_rounded, size: 16),
                        label: const Text('+ Add Profile'),
                        onPressed: _showAddProfileDialog,
                      ),
                    ],
                  );
                },
                loading: () => const LinearProgressIndicator(),
                error: (_, __) => const Text('Unable to load profiles.'),
              ),
              const SizedBox(height: 24),

              // Doctor Name Field (Optional)
              TextField(
                controller: _doctorController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Doctor Name (Optional)',
                  hintText: 'e.g. Dr. Rajesh Sharma',
                  prefixIcon: Icon(Icons.medical_services_outlined),
                ),
              ),
              const SizedBox(height: 18),

              // Prescription Date Field (Default Today)
              InkWell(
                onTap: () => _selectDate(context),
                borderRadius: AppTheme.defaultBorderRadius,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: AppTheme.defaultBorderRadius,
                    border: Border.all(color: AppColors.border, width: 1.2),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today_rounded,
                          color: AppColors.primaryBlue, size: 20),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Prescription Date',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_drop_down_rounded, color: AppColors.textSecondary),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 28),

              // Uploading Progress & Status Card
              if (captureState.isUploading) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: AppTheme.defaultBorderRadius,
                    border: Border.all(color: AppColors.border),
                    boxShadow: const [AppColors.softShadow],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Uploading to encrypted storage...',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          Text(
                            '${(captureState.uploadProgress * 100).toInt()}%',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primaryBlue,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: captureState.uploadProgress > 0
                              ? captureState.uploadProgress
                              : null,
                          backgroundColor: AppColors.divider,
                          valueColor: const AlwaysStoppedAnimation(AppColors.primaryBlue),
                          minHeight: 8,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              if (captureState.errorMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    captureState.errorMessage!,
                    style: const TextStyle(color: AppColors.error, fontSize: 13),
                  ),
                ),

              // Save & Finish Button
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  minimumSize: const Size(double.infinity, 54),
                ),
                onPressed: captureState.isUploading ? null : _handleSave,
                child: captureState.isUploading
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation(Colors.white),
                        ),
                      )
                    : const Text('Save Prescription & Vault Image'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}
