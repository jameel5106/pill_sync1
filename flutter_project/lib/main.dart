import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'core/theme/app_theme.dart';
import 'core/i18n/app_languages.dart';
import 'core/router/app_router.dart';
import 'features/auth/presentation/auth_providers.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase (Generated via flutterfire configure)
  try {
    await Firebase.initializeApp();
    
    // Enable offline persistence for Cloud Firestore
    FirebaseFirestore.instance.settings = const Settings(
      persistenceEnabled: true,
      cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
    );
  } catch (e) {
    // Allows preview/test execution even if firebase_options hasn't been generated yet
    debugPrint('Firebase initialization notice: $e');
  }

  runApp(
    const ProviderScope(
      child: PillSyncApp(),
    ),
  );
}

/// Root Application Widget with Lifecycle Monitoring for App Lock (1-min timeout)
/// and dynamic locale/directionality support (RTL for Urdu).
class PillSyncApp extends ConsumerStatefulWidget {
  const PillSyncApp({super.key});

  @override
  ConsumerState<PillSyncApp> createState() => _PillSyncAppState();
}

class _PillSyncAppState extends ConsumerState<PillSyncApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final lockNotifier = ref.read(appLockProvider.notifier);

    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      // User pressed Home or opened App Switcher
      lockNotifier.onAppBackgrounded();
    } else if (state == AppLifecycleState.resumed) {
      // User returned to app; evaluate if > 1 minute elapsed
      lockNotifier.onAppResumed();
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final activeLanguage = ref.watch(languageProvider);

    return MaterialApp.router(
      title: 'PillSync',
      debugShowCheckedModeBanner: false,

      // Routing
      routerConfig: router,

      // Material 3 Strict Light Theme with dynamic script fonts
      theme: AppTheme.light(activeLanguage.code),

      // i18n & Regional Indian Languages
      locale: activeLanguage.locale,
      supportedLocales: AppLanguages.supportedLocales,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],

      // Enforce proper TextDirection (RTL for Urdu, LTR for others)
      builder: (context, child) {
        return Directionality(
          textDirection: activeLanguage.textDirection,
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
