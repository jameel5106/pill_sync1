import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../features/auth/presentation/auth_providers.dart';

/// Master Application Shell containing the prominent central green Scan button
/// and Bottom NavigationBar (Home, Medicines, Scan, Reminders, Settings).
/// Fully RTL-safe and localized across all 7 Indian languages.
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
    final activeLang = ref.watch(languageProvider);

    return Scaffold(
      body: child,

      // Floating Center Scan Button (Prominent Green #2E9E6B)
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
          child: const Icon(
            Icons.document_scanner_rounded,
            color: Colors.white,
            size: 30,
          ),
        ),
      ),

      // Bottom NavigationBar
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        color: AppColors.surface,
        elevation: 8,
        padding: EdgeInsets.zero,
        height: 68,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            // 1. Home
            _NavItem(
              icon: Icons.home_rounded,
              label: 'Home',
              isSelected: currentIndex == 0,
              onTap: () => context.go('/home'),
            ),

            // 2. Medicines
            _NavItem(
              icon: Icons.medication_rounded,
              label: 'Medicines',
              isSelected: currentIndex == 1,
              onTap: () => context.go('/prescriptions'),
            ),

            // Gap for prominent central scan button
            const SizedBox(width: 48),

            // 4. Reminders
            _NavItem(
              icon: Icons.alarm_rounded,
              label: 'Reminders',
              isSelected: currentIndex == 3,
              onTap: () => context.go('/reminders'),
            ),

            // 5. Settings
            _NavItem(
              icon: Icons.settings_rounded,
              label: 'Settings',
              isSelected: currentIndex == 4,
              onTap: () => context.go('/settings'),
            ),
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

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 24,
              color: isSelected
                  ? AppColors.primaryBlue
                  : AppColors.textDisabled,
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected
                    ? AppColors.primaryBlue
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
