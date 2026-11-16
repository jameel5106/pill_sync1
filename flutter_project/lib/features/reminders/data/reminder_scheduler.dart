import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import '../../schedule/domain/schedule_models.dart';

/// ReminderScheduler: handles high-reliability local alarms & push notifications
/// for medication reminders in PillSync.
/// Complies with iOS 64-scheduled notification limit via a rolling window.
class ReminderScheduler {
  static final ReminderScheduler _instance = ReminderScheduler._internal();
  factory ReminderScheduler() => _instance;
  ReminderScheduler._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static const String notificationChannelId = 'pillsync_med_reminders';
  static const String notificationChannelName = 'PillSync Medication Reminders';
  static const String notificationChannelDesc =
      'Urgent reminders to take medicines on time';

  // Action IDs for interactive notifications
  static const String actionTaken = 'ACTION_TAKEN';
  static const String actionSnooze15 = 'ACTION_SNOOZE_15';
  static const String actionSkip = 'ACTION_SKIP';

  /// Maximum notifications scheduled in advance for iOS
  static const int maxIosScheduledNotifications = 64;

  Future<void> initialize({
    void Function(String doseInstanceId, String actionId)? onActionTapped,
  }) async {
    tz.initializeTimeZones();

    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings iosSettings =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
      notificationCategories: [
        DarwinNotificationCategory(
          'MEDICINE_REMINDER',
          actions: [
            DarwinNotificationAction.plain(
              actionTaken,
              'Mark as Taken',
              options: {DarwinNotificationActionOption.foreground},
            ),
            DarwinNotificationAction.plain(
              actionSnooze15,
              'Snooze 15 min',
            ),
          ],
        ),
      ],
    );

    const InitializationSettings initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notificationsPlugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        if (response.payload != null && onActionTapped != null) {
          final actionId = response.actionId ?? actionTaken;
          onActionTapped(response.payload!, actionId);
        }
      },
    );

    // Create Android High-Importance Channel
    if (Platform.isAndroid) {
      final AndroidNotificationChannel channel = AndroidNotificationChannel(
        notificationChannelId,
        notificationChannelName,
        description: notificationChannelDesc,
        importance: Importance.max,
        sound: const RawResourceAndroidNotificationSound('medicine_chime'),
        enableVibration: true,
        playSound: true,
      );

      await _notificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  /// Schedules medication reminders across a rolling 7-day window.
  /// For iOS, bounds to the top 64 chronological slots.
  Future<int> scheduleRollingWindow(List<ScheduledDose> upcomingDoses) async {
    await cancelAllReminders();

    // Sort chronologically
    final sortedDoses = List<ScheduledDose>.from(upcomingDoses)
      ..sort((a, b) => a.scheduledTime.compareTo(b.scheduledTime));

    final now = DateTime.now();
    final futureDoses = sortedDoses
        .where((d) => d.scheduledTime.isAfter(now) && d.status == DoseStatus.pending)
        .toList();

    // Cap at iOS limit if on iOS
    final dosesToSchedule = Platform.isIOS
        ? futureDoses.take(maxIosScheduledNotifications).toList()
        : futureDoses;

    int scheduledCount = 0;
    for (int i = 0; i < dosesToSchedule.length; i++) {
      final dose = dosesToSchedule[i];
      await _scheduleSingleDoseNotification(
        id: i + 1,
        dose: dose,
      );
      scheduledCount++;
    }

    return scheduledCount;
  }

  Future<void> _scheduleSingleDoseNotification({
    required int id,
    required ScheduledDose dose,
  }) async {
    final scheduledDate = tz.TZDateTime.from(dose.scheduledTime, tz.local);

    final String title = 'Time for ${dose.medicineName}';
    final String body = '${dose.doseAmount} • ${dose.instructions}';

    final androidDetails = AndroidNotificationDetails(
      notificationChannelId,
      notificationChannelName,
      channelDescription: notificationChannelDesc,
      importance: Importance.max,
      priority: Priority.high,
      category: AndroidNotificationCategory.reminder,
      actions: <AndroidNotificationAction>[
        const AndroidNotificationAction(
          actionTaken,
          'Taken ✓',
          showsUserInterface: true,
        ),
        const AndroidNotificationAction(
          actionSnooze15,
          'Snooze 15m',
        ),
      ],
    );

    final iosDetails = const DarwinNotificationDetails(
      categoryIdentifier: 'MEDICINE_REMINDER',
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notificationsPlugin.zonedSchedule(
      id,
      title,
      body,
      scheduledDate,
      details,
      payload: dose.id,
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
    );
  }

  /// Snoozes a dose by 15 minutes
  Future<void> snoozeDose(ScheduledDose dose, {int minutes = 15}) async {
    final snoozeTime = DateTime.now().add(Duration(minutes: minutes));
    final snoozedDose = ScheduledDose(
      id: '${dose.id}_snooze',
      prescriptionId: dose.prescriptionId,
      medicineName: dose.medicineName,
      doseAmount: dose.doseAmount,
      scheduledTime: snoozeTime,
      slot: dose.slot,
      instructions: '${dose.instructions} (Snoozed)',
    );

    await _scheduleSingleDoseNotification(
      id: (DateTime.now().millisecondsSinceEpoch % 100000),
      dose: snoozedDose,
    );
  }

  Future<void> cancelAllReminders() async {
    await _notificationsPlugin.cancelAll();
  }
}
