import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_cropper/image_cropper.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/ui/permission_dialog.dart';
import '../capture_providers.dart';

/// Camera Capture & Document Import Screen.
/// Supports high-res Camera, Gallery (HEIC/PNG/JPEG), and PDF first-page import.
/// Enforces max 10MB limit and provides Crop/Rotate integration.
class CameraCaptureScreen extends ConsumerStatefulWidget {
  const CameraCaptureScreen({super.key});

  @override
  ConsumerState<CameraCaptureScreen> createState() =>
      _CameraCaptureScreenState();
}

class _CameraCaptureScreenState extends ConsumerState<CameraCaptureScreen> {
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _handleSource(Future<File?> Function() pickerFn) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final file = await pickerFn();
      if (file == null) {
        setState(() => _isLoading = false);
        return;
      }

      // 10 MB validation
      final size = await file.length();
      if (size > 10 * 1024 * 1024) {
        setState(() {
          _isLoading = false;
          _errorMessage =
              'File size exceeds 10 MB limit. Please select a smaller photo or document.';
        });
        return;
      }

      // Crop & Rotate tool
      final cropped = await ImageCropper().cropImage(
        sourcePath: file.path,
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: 'Crop Prescription',
            toolbarColor: AppColors.primaryBlue,
            toolbarWidgetColor: Colors.white,
            initAspectRatio: CropAspectRatioPreset.original,
            lockAspectRatio: false,
          ),
          IOSUiSettings(
            title: 'Crop Prescription',
            aspectRatioLockEnabled: false,
          ),
        ],
      );

      final targetFile = cropped != null ? File(cropped.path) : file;

      // Run quality diagnostic check and compression
      final success = await ref
          .read(captureControllerProvider.notifier)
          .processImage(targetFile);

      if (success && mounted) {
        context.push('/quality-check');
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(prescriptionRepositoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Capture Prescription'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Framing guidelines card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.primaryBlueLight.withOpacity(0.4),
                  borderRadius: AppTheme.defaultBorderRadius,
                  border: Border.all(color: AppColors.primaryBlue.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.lightbulb_outline_rounded,
                        color: AppColors.primaryBlue,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Tips for Clear Transcription',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'Place prescription flat under good lighting. Avoid heavy shadows and blur so medicine names are easily readable.',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              if (_errorMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 20),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: AppColors.error, fontSize: 13),
                  ),
                ),

              // Visual Viewfinder Mock
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppTheme.defaultBorderRadius,
                    border: Border.all(
                      color: AppColors.border,
                      width: 2,
                    ),
                    boxShadow: const [AppColors.softShadow],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Viewfinder border guides
                      Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Container(
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: AppColors.primaryBlue.withOpacity(0.4),
                              style: BorderStyle.solid,
                              width: 1.5,
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                      Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: AppColors.primaryBlueLight,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.document_scanner_rounded,
                              size: 48,
                              color: AppColors.primaryBlue,
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Align Prescription Within Frame',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Max 10 MB • Auto-enhancement & Crop ready',
                            style: TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Action Buttons: Camera, Gallery, PDF
              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: CircularProgressIndicator(),
                  ),
                )
              else ...[
                // Primary Camera Trigger
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accentGreen,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 54),
                  ),
                  onPressed: () async {
                    final granted = await PermissionDialog.requestCamera(context);
                    if (granted) {
                      _handleSource(() => repo.pickFromCamera());
                    }
                  },
                  icon: const Icon(Icons.camera_alt_rounded),
                  label: const Text('Take Photo with Camera'),
                ),
                const SizedBox(height: 12),

                // Secondary Gallery Pick
                OutlinedButton.icon(
                  onPressed: () => _handleSource(() => repo.pickFromGallery()),
                  icon: const Icon(Icons.photo_library_rounded),
                  label: const Text('Choose from Gallery (HEIC supported)'),
                ),
                const SizedBox(height: 8),

                // PDF Import
                TextButton.icon(
                  onPressed: () => _handleSource(() => repo.pickPdfDocument()),
                  icon: const Icon(Icons.picture_as_pdf_rounded),
                  label: const Text('Import Medical PDF (First Page)'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
