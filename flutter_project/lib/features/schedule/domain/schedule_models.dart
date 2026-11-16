enum DoseStatus {
  pending,
  taken,
  skipped,
  missed;

  String get label {
    switch (this) {
      case DoseStatus.pending: return 'Pending';
      case DoseStatus.taken: return 'Taken';
      case DoseStatus.skipped: return 'Skipped';
      case DoseStatus.missed: return 'Missed';
    }
  }
}

enum TimeOfDayCategory {
  morning,
  afternoon,
  evening,
  night,
  sos;

  String get label {
    switch (this) {
      case TimeOfDayCategory.morning: return 'Morning';
      case TimeOfDayCategory.afternoon: return 'Afternoon';
      case TimeOfDayCategory.evening: return 'Evening';
      case TimeOfDayCategory.night: return 'Night';
      case TimeOfDayCategory.sos: return 'As Needed (SOS)';
    }
  }
}

/// Represents an individual scheduled dose slot
class ScheduledDose {
  final String id;
  final String prescriptionId;
  final String medicineId;
  final String medicineName;
  final String transliteratedName;
  final String doseAmount;
  final String foodInstruction;
  final DateTime scheduledTimeUtc;
  final TimeOfDayCategory category;
  final DoseStatus status;
  final DateTime? loggedAt;
  final bool isSos;

  const ScheduledDose({
    required this.id,
    required this.prescriptionId,
    required this.medicineId,
    required this.medicineName,
    required this.transliteratedName,
    required this.doseAmount,
    required this.foodInstruction,
    required this.scheduledTimeUtc,
    required this.category,
    this.status = DoseStatus.pending,
    this.loggedAt,
    this.isSos = false,
  });

  ScheduledDose copyWith({
    DoseStatus? status,
    DateTime? loggedAt,
    DateTime? scheduledTimeUtc,
  }) {
    return ScheduledDose(
      id: id,
      prescriptionId: prescriptionId,
      medicineId: medicineId,
      medicineName: medicineName,
      transliteratedName: transliteratedName,
      doseAmount: doseAmount,
      foodInstruction: foodInstruction,
      scheduledTimeUtc: scheduledTimeUtc ?? this.scheduledTimeUtc,
      category: category,
      status: status ?? this.status,
      loggedAt: loggedAt ?? this.loggedAt,
      isSos: isSos,
    );
  }
}

/// User's customizable daily routine meal & sleep schedule
class MealTimesConfig {
  final int wakeHour;
  final int wakeMinute;
  final int breakfastHour;
  final int breakfastMinute;
  final int lunchHour;
  final int lunchMinute;
  final int dinnerHour;
  final int dinnerMinute;
  final int bedtimeHour;
  final int bedtimeMinute;

  const MealTimesConfig({
    this.wakeHour = 7,
    this.wakeMinute = 0,
    this.breakfastHour = 8,
    this.breakfastMinute = 0,
    this.lunchHour = 13,
    this.lunchMinute = 0,
    this.dinnerHour = 20,
    this.dinnerMinute = 0,
    this.bedtimeHour = 22,
    this.bedtimeMinute = 0,
  });
}
