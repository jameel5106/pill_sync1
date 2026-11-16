import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/presentation/auth_providers.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/auth/presentation/screens/language_selection_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/signup_screen.dart';
import '../../features/auth/presentation/screens/security_setup_screen.dart';
import '../../features/auth/presentation/screens/app_lock_screen.dart';
import '../../features/home/presentation/screens/home_dashboard_screen.dart';
import '../../features/capture/presentation/screens/camera_capture_screen.dart';
import '../../features/capture/presentation/screens/quality_check_screen.dart';
import '../../features/capture/presentation/screens/prescription_metadata_screen.dart';
import '../../features/capture/presentation/screens/prescription_list_screen.dart';
import '../../features/parsing/presentation/screens/review_confirm_screen.dart';
import '../../features/schedule/presentation/screens/today_schedule_screen.dart';
import '../../features/courses/presentation/screens/course_followup_screen.dart';
import '../../features/assistant/presentation/screens/assistant_chat_screen.dart';
import '../../features/assistant/presentation/screens/emergency_screen.dart';
import '../../features/settings/presentation/screens/family_profiles_screen.dart';
import '../../features/settings/presentation/screens/privacy_dashboard_screen.dart';
import '../../shared/ui/app_scaffold_shell.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final lockState = ref.watch(appLockProvider);

  return GoRouter(
    initialLocation: '/splash',
    debugLogDiagnostics: false,
    redirect: (BuildContext context, GoRouterState state) {
      final bool isAuthenticated = authState.valueOrNull != null;
      final String loc = state.uri.path;

      // Handle App Lock overlay guard first
      if (lockState.isLocked && loc != '/app-lock' && loc != '/splash') {
        return '/app-lock';
      }

      final bool isAuthRoute = loc == '/login' ||
          loc == '/signup' ||
          loc == '/language' ||
          loc == '/splash';

      // Unauthenticated users are strictly guarded and redirected to login
      if (!isAuthenticated && !isAuthRoute) {
        return '/login';
      }

      // Authenticated users trying to access login/signup get redirected to home
      if (isAuthenticated && (loc == '/login' || loc == '/signup')) {
        return '/home';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/language',
        builder: (context, state) => const LanguageSelectionScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/signup',
        builder: (context, state) => const SignUpScreen(),
      ),
      GoRoute(
        path: '/security-setup',
        builder: (context, state) => const SecuritySetupScreen(),
      ),
      GoRoute(
        path: '/app-lock',
        builder: (context, state) => const AppLockScreen(),
      ),

      // App Shell with Bottom Navigation (Home, Medicines, Reminders, Settings)
      ShellRoute(
        builder: (context, state, child) {
          int index = 0;
          final path = state.uri.path;
          if (path.startsWith('/prescriptions')) {
            index = 1;
          } else if (path.startsWith('/reminders') || path.startsWith('/schedule')) {
            index = 3;
          } else if (path.startsWith('/settings') || path.startsWith('/privacy')) {
            index = 4;
          }
          return AppScaffoldShell(
            currentIndex: index,
            child: child,
          );
        },
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) => const HomeDashboardScreen(),
          ),
          GoRoute(
            path: '/prescriptions',
            builder: (context, state) => const PrescriptionListScreen(),
          ),
          GoRoute(
            path: '/reminders',
            builder: (context, state) => const TodayScheduleScreen(),
          ),
          GoRoute(
            path: '/settings',
            builder: (context, state) => const PrivacyDashboardScreen(),
          ),
        ],
      ),

      // Capture flow modal / stack screens
      GoRoute(
        path: '/capture',
        builder: (context, state) => const CameraCaptureScreen(),
      ),
      GoRoute(
        path: '/quality-check',
        builder: (context, state) => const QualityCheckScreen(),
      ),
      GoRoute(
        path: '/prescription-metadata',
        builder: (context, state) => const PrescriptionMetadataScreen(),
      ),
      GoRoute(
        path: '/review-confirm',
        builder: (context, state) => const ReviewConfirmScreen(
          prescriptionId: 'rx_demo',
          imagePath: 'assets/sample_rx.jpg',
        ),
      ),
      GoRoute(
        path: '/courses',
        builder: (context, state) => const CourseFollowupScreen(),
      ),
      GoRoute(
        path: '/assistant',
        builder: (context, state) => const AssistantChatScreen(),
      ),
      GoRoute(
        path: '/emergency',
        builder: (context, state) => const EmergencyScreen(),
      ),
      GoRoute(
        path: '/family-profiles',
        builder: (context, state) => const FamilyProfilesScreen(),
      ),
      GoRoute(
        path: '/privacy-dashboard',
        builder: (context, state) => const PrivacyDashboardScreen(),
      ),
    ],
  );
});
