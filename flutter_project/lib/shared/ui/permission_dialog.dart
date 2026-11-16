import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Friendly permission explanation dialog with "Open Settings" for permanently denied state.
class PermissionDialog extends StatelessWidget {
  final String title;
  final String description;
  final bool isPermanentlyDenied;
  final VoidCallback onRetry;

  const PermissionDialog({
    super.key,
    required this.title,
    required this.description,
    this.isPermanentlyDenied = false,
    required this.onRetry,
  });

  static Future<bool> requestCamera(BuildContext context) async {
    final status = await Permission.camera.request();
    if (status.isGranted) return true;

    if (context.mounted) {
      showDialog(
        context: context,
        builder: (ctx) => PermissionDialog(
          title: 'Camera Permission Required',
          description:
              'PillSync needs camera access to photograph doctor prescriptions and extract medication dosages securely.',
          isPermanentlyDenied: status.isPermanentlyDenied,
          onRetry: () async {
            Navigator.of(ctx).pop();
            if (status.isPermanentlyDenied) {
              await openAppSettings();
            } else {
              await Permission.camera.request();
            }
          },
        ),
      );
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: const RoundedRectangleBorder(
        borderRadius: AppTheme.defaultBorderRadius,
      ),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primaryBlueLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.camera_alt_rounded,
                color: AppColors.primaryBlue, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
      content: Text(
        description,
        style: const TextStyle(
          fontSize: 14,
          color: AppColors.textSecondary,
          height: 1.4,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            minimumSize: const Size(120, 44),
          ),
          onPressed: onRetry,
          child: Text(isPermanentlyDenied ? 'Open Settings' : 'Allow Access'),
        ),
      ],
    );
  }
}
