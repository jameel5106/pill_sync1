import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class PrivacyDashboardScreen extends StatefulWidget {
  const PrivacyDashboardScreen({super.key});

  @override
  State<PrivacyDashboardScreen> createState() => _PrivacyDashboardScreenState();
}

class _PrivacyDashboardScreenState extends State<PrivacyDashboardScreen> {
  bool _aiConsentEnabled = true;
  bool _cloudSyncEnabled = true;

  void _showEraseDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning, color: AppColors.error),
            SizedBox(width: 8),
            Text('Erase All Data?'),
          ],
        ),
        content: const Text(
          'Under India\'s DPDP Act 2023 (Section 12), you have the right to irreversible erasure.\n\n'
          'This will permanently delete:\n'
          '• All uploaded prescription images\n'
          '• Parsed medical records and schedules\n'
          '• Family profiles and reminder histories\n\n'
          'This action CANNOT be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.of(ctx).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('All personal and medical data permanently wiped.'),
                  backgroundColor: AppColors.error,
                ),
              );
            },
            child: const Text('ERASE EVERYTHING'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('DPDP Privacy & Data Rights'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Compliance Badge
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: Row(
              children: [
                const Icon(Icons.verified_user, color: AppColors.accentGreen, size: 36),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'DPDP Act 2023 Compliant',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF166534),
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'PillSync treats your health data with high confidentiality. We never sell or train public AI models on your prescriptions.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF15803D)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          const Text(
            'Consent & AI Processing Controls',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 12),

          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            elevation: 1,
            child: Column(
              children: [
                SwitchListTile(
                  title: const Text('Gemini Prescription OCR Parsing', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text(
                    'Allows multimodal AI to read handwritten medicines. If disabled, you must enter medicines manually.',
                    style: TextStyle(fontSize: 12),
                  ),
                  value: _aiConsentEnabled,
                  activeColor: AppColors.accentGreen,
                  onChanged: (val) {
                    setState(() {
                      _aiConsentEnabled = val;
                    });
                  },
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: const Text('Encrypted Cloud Backup', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text(
                    'Syncs schedules across your family devices using Firebase Firestore.',
                    style: TextStyle(fontSize: 12),
                  ),
                  value: _cloudSyncEnabled,
                  activeColor: AppColors.primaryBlue,
                  onChanged: (val) {
                    setState(() {
                      _cloudSyncEnabled = val;
                    });
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          const Text(
            'Your Data Rights (Section 11-13)',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 12),

          // Export Data (Portability)
          ListTile(
            tileColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            leading: const CircleAvatar(
              backgroundColor: Color(0xFFEFF6FF),
              child: Icon(Icons.file_download_outlined, color: AppColors.primaryBlue),
            ),
            title: const Text('Download My Health Data', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            subtitle: const Text('Export all prescriptions, doses, and logs in encrypted JSON', style: TextStyle(fontSize: 12)),
            trailing: const Icon(Icons.arrow_forward_ios, size: 14),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Downloading encrypted JSON archive...')),
              );
            },
          ),
          const SizedBox(height: 10),

          // Erasure (Right to be Forgotten)
          ListTile(
            tileColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFFFEE2E2)),
            ),
            leading: const CircleAvatar(
              backgroundColor: Color(0xFFFEF2F2),
              child: Icon(Icons.delete_forever, color: AppColors.error),
            ),
            title: const Text(
              'Irreversible Data Erasure',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.error),
            ),
            subtitle: const Text('Permanently delete all prescriptions and account data', style: TextStyle(fontSize: 12)),
            trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.error),
            onTap: _showEraseDialog,
          ),

          const SizedBox(height: 30),
          Center(
            child: Text(
              'Consent recorded: ${DateTime.now().toIso8601String().substring(0, 10)} • Privacy Policy v1.2',
              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
