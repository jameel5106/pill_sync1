import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/ui/medical_disclaimer_footer.dart';
import '../../../../shared/ui/offline_banner.dart';
import '../../../auth/presentation/auth_providers.dart';
import '../../../capture/presentation/capture_providers.dart';

/// PillSync Home Dashboard with personalized time-aware greeting,
/// summary cards (Today's medicines, Reminders, Active courses), prominent Scan CTA,
/// and permanent statutory medical disclaimer footer.
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
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primaryBlueLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.medical_services_rounded,
                color: AppColors.primaryBlue,
                size: 20,
              ),
            ),
            const SizedBox(width: 8),
            const Text('PillSync', style: TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Language & Settings',
            icon: const Icon(Icons.language_rounded),
            onPressed: () => context.push('/language'),
          ),
          IconButton(
            tooltip: 'Lock App',
            icon: const Icon(Icons.lock_clock_outlined),
            onPressed: () {
              ref.read(appLockProvider.notifier).lockImmediately();
              context.go('/app-lock');
            },
          ),
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
                    // Personalized Header Greeting
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$greeting,',
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                user?.displayName ?? 'Patient',
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.accentGreenLight,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.accentGreen.withOpacity(0.3)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.shield_rounded, color: AppColors.accentGreen, size: 14),
                              SizedBox(width: 4),
                              Text(
                                'DPDP Protected',
                                style: TextStyle(
                                  color: AppColors.accentGreenDark,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // BIG GREEN SCAN A PRESCRIPTION BUTTON
                    Container(
                      decoration: BoxDecoration(
                        borderRadius: AppTheme.defaultBorderRadius,
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.accentGreen.withOpacity(0.3),
                            blurRadius: 16,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.accentGreen,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(double.infinity, 58),
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          shape: const RoundedRectangleBorder(
                            borderRadius: AppTheme.defaultBorderRadius,
                          ),
                        ),
                        onPressed: () => context.push('/capture'),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.document_scanner_rounded, size: 24),
                            SizedBox(width: 10),
                            Text(
                              'Scan a Prescription',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.2,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // CARD 1: Today's Medicines
                    _DashboardCard(
                      title: "Today's Medicines",
                      icon: Icons.access_time_filled_rounded,
                      iconColor: AppColors.primaryBlue,
                      countBadge: '0 doses',
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.primaryBlueLight.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(10),
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
                                Icons.medication_liquid_rounded,
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
                                    'No medicines scheduled today',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  SizedBox(height: 2),
                                  Text(
                                    'Scan your doctor prescription to automatically generate dosage reminders.',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                      height: 1.3,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // CARD 2: Upcoming Reminders
                    _DashboardCard(
                      title: 'Upcoming Reminders',
                      icon: Icons.alarm_on_rounded,
                      iconColor: AppColors.accentGreen,
                      countBadge: 'Active',
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.accentGreenLight.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.check_circle_outline_rounded,
                                color: AppColors.accentGreen, size: 28),
                            SizedBox(width: 14),
                            Expanded(
                              child: Text(
                                'All caught up! Next dose notifications will appear here once a prescription is confirmed.',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary,
                                  height: 1.35,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // CARD 3: Active Courses
                    _DashboardCard(
                      title: 'Active Courses',
                      icon: Icons.calendar_month_rounded,
                      iconColor: AppColors.warning,
                      countBadge: prescriptionsAsync.when(
                        data: (list) => '${list.length} Prescriptions',
                        loading: () => '...',
                        error: (_, __) => '0',
                      ),
                      child: prescriptionsAsync.when(
                        data: (prescriptions) {
                          if (prescriptions.isEmpty) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: Text(
                                'No active prescription courses. Upload a photo or PDF to get started.',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            );
                          }
                          return Column(
                            children: prescriptions.take(3).map((rx) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 8.0),
                                child: ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  leading: Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryBlueLight,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(
                                      Icons.receipt_long_rounded,
                                      color: AppColors.primaryBlue,
                                    ),
                                  ),
                                  title: Text(
                                    rx.doctorName ?? 'Prescription #${rx.id.substring(rx.id.length - 4)}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                  subtitle: Text(
                                    'For: ${rx.profileName} • ${rx.prescriptionDate.day}/${rx.prescriptionDate.month}/${rx.prescriptionDate.year}',
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                  trailing: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryBlueLight,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      rx.status.label,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.primaryBlueDark,
                                      ),
                                    ),
                                  ),
                                  onTap: () => context.push('/prescriptions'),
                                ),
                              );
                            }).toList(),
                          );
                        },
                        loading: () => const Center(
                          child: CircularProgressIndicator(),
                        ),
                        error: (_, __) => const Text(
                          'Unable to load courses.',
                          style: TextStyle(color: AppColors.error, fontSize: 13),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // PERMANENT STATUTORY DISCLAIMER FOOTER ON MEDICAL SCREENS
            const MedicalDisclaimerFooter(),
          ],
        ),
      ),
    );
  }
}

class _DashboardCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color iconColor;
  final String countBadge;
  final Widget child;

  const _DashboardCard({
    required this.title,
    required this.icon,
    required this.iconColor,
    required this.countBadge,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
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
            children: [
              Icon(icon, color: iconColor, size: 20),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.divider,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  countBadge,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
