import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../capture_providers.dart';

/// Pre-upload quality inspection screen.
/// Automatically evaluates darkness, blur, and resolution to prevent erroneous OCR transcription.
class QualityCheckScreen extends ConsumerWidget {
  const QualityCheckScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final captureState = ref.watch(captureControllerProvider);
    final file = captureState.processedFile ?? captureState.rawFile;
    final quality = captureState.qualityResult;

    if (file == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Quality Inspection')),
        body: const Center(child: Text('No image found.')),
      );
    }

    final hasWarnings = quality != null && !quality.isAcceptable;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Prescription Quality Check'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Image Preview Card
              Container(
                height: 280,
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: AppTheme.defaultBorderRadius,
                  boxShadow: const [AppColors.softShadow],
                ),
                clipBehavior: Clip.antiAlias,
                child: Image.file(
                  file,
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(height: 20),

              // Status Summary Banner
              if (!hasWarnings)
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.accentGreenLight,
                    borderRadius: AppTheme.defaultBorderRadius,
                    border: Border.all(color: AppColors.accentGreen.withOpacity(0.4)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.check_circle_rounded,
                          color: AppColors.accentGreen, size: 24),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Quality check passed! Prescription is sharp, well-lit, and ready for translation.',
                          style: TextStyle(
                            color: AppColors.accentGreenDark,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.warningLight,
                    borderRadius: AppTheme.defaultBorderRadius,
                    border: Border.all(color: AppColors.warning.withOpacity(0.5)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.warning_amber_rounded,
                          color: AppColors.warning, size: 24),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Potential clarity issues detected. You can proceed, but retaking may yield higher accuracy.',
                          style: TextStyle(
                            color: Color(0xFF92400E),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),

              // Detailed Metric Badges
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: AppTheme.defaultBorderRadius,
                  border: Border.all(color: AppColors.border),
                  boxShadow: const [AppColors.softShadow],
                ),
                child: Column(
                  children: [
                    _CheckItem(
                      title: 'Sharpness & Blur',
                      subtitle: quality?.isBlurry == true
                          ? 'Image might be blurry; doctor handwriting may fail OCR'
                          : 'Clear focus detected across text lines',
                      isWarning: quality?.isBlurry == true,
                    ),
                    const Divider(height: 20),
                    _CheckItem(
                      title: 'Lighting & Darkness',
                      subtitle: quality?.isDark == true
                          ? 'Image is dark or shadowed; details may be lost'
                          : 'Adequate lighting and contrast detected',
                      isWarning: quality?.isDark == true,
                    ),
                    const Divider(height: 20),
                    _CheckItem(
                      title: 'Resolution Check',
                      subtitle: quality?.isLowResolution == true
                          ? 'Low resolution. Text might pixelate when enlarged'
                          : 'High resolution (> 1600px long edge)',
                      isWarning: quality?.isLowResolution == true,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Retake and Proceed buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 52),
                      ),
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Retake'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.accentGreen,
                        minimumSize: const Size(0, 52),
                      ),
                      onPressed: () => context.push('/prescription-metadata'),
                      icon: const Icon(Icons.arrow_forward_rounded),
                      label: const Text('Proceed to Details'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}

class _CheckItem extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool isWarning;

  const _CheckItem({
    required this.title,
    required this.subtitle,
    required this.isWarning,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          isWarning ? Icons.error_outline_rounded : Icons.check_circle_rounded,
          color: isWarning ? AppColors.warning : AppColors.accentGreen,
          size: 20,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 12,
                  color: isWarning ? AppColors.warning : AppColors.textSecondary,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
