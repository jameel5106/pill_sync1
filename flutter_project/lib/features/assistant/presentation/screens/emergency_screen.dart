import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/app_colors.dart';

class EmergencyScreen extends StatelessWidget {
  final String? triggeredSymptom;
  final String? detectedLanguage;

  const EmergencyScreen({
    super.key,
    this.triggeredSymptom,
    this.detectedLanguage,
  });

  Future<void> _makeCall(String phoneNumber) async {
    final uri = Uri(scheme: 'tel', path: phoneNumber);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFEF2F2),
      appBar: AppBar(
        backgroundColor: AppColors.error,
        foregroundColor: Colors.white,
        title: const Text(
          'MEDICAL EMERGENCY',
          style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.1),
        ),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Exit emergency screen',
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // High Alert Banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.error,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.error.withOpacity(0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.warning_amber_rounded,
                      color: Colors.white,
                      size: 44,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Seek Immediate Care',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            triggeredSymptom != null
                              ? 'Critical symptom detected: "$triggeredSymptom"'
                              : 'Emergency conditions detected. Do not wait.',
                            style: const TextStyle(
                              color: Color(0xFFFFE4E6),
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              const Text(
                'Instant Emergency Numbers (India)',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),

              // 112 National Emergency
              _EmergencyCallCard(
                title: '112 - National Emergency',
                subtitle: 'All-in-one emergency response (Police, Fire, Medical)',
                number: '112',
                color: const Color(0xFFDC2626),
                icon: Icons.emergency,
                onTap: () => _makeCall('112'),
              ),
              const SizedBox(height: 12),

              // 108 Ambulance
              _EmergencyCallCard(
                title: '108 - Medical Ambulance',
                subtitle: 'Government emergency ambulance service across states',
                number: '108',
                color: const Color(0xFFEA580C),
                icon: Icons.local_hospital,
                onTap: () => _makeCall('108'),
              ),
              const SizedBox(height: 12),

              // 14416 Tele-MANAS
              _EmergencyCallCard(
                title: '14416 - Tele-MANAS',
                subtitle: 'National mental health and distress crisis helpline (Toll Free)',
                number: '14416',
                color: const Color(0xFF0284C7),
                icon: Icons.favorite,
                onTap: () => _makeCall('14416'),
              ),
              const SizedBox(height: 24),

              // GPS / Location card for emergency personnel
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.my_location, color: AppColors.primaryBlue, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Your Location for Paramedics',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Share with the dispatcher: Near City Center Hospital, Sector 4, Bangalore (Lat: 12.9716° N, Long: 77.5946° E)',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () {
                        Clipboard.setData(const ClipboardData(
                          text: '12.9716, 77.5946 (Sector 4, Bangalore)',
                        ));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Coordinates copied to clipboard')),
                        );
                      },
                      icon: const Icon(Icons.copy, size: 16),
                      label: const Text('Copy Coordinates to Clipboard'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primaryBlue,
                        side: const BorderSide(color: AppColors.primaryBlue),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              // What to do while waiting
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'While Help Is On The Way:',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF92400E),
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      '• Keep patient seated or resting in a comfortable position.\n'
                      '• Loosen tight clothing around neck and chest.\n'
                      '• Do NOT give food, drink, or unprescribed pills.\n'
                      '• Keep prescription strips and packaging ready for doctors.',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF78350F),
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmergencyCallCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String number;
  final Color color;
  final IconData icon;
  final VoidCallback onTap;

  const _EmergencyCallCard({
    required this.title,
    required this.subtitle,
    required this.number,
    required this.color,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.3), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.08),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            ElevatedButton.icon(
              onPressed: onTap,
              icon: const Icon(Icons.call, size: 16),
              label: Text('CALL $number'),
              style: ElevatedButton.styleFrom(
                backgroundColor: color,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
