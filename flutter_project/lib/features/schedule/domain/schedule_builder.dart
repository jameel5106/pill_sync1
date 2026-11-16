import 'schedule_models.dart';
import '../../parsing/domain/parsed_prescription.dart';

/// Pure Dart deterministic schedule builder with zero AI hallucinations.
/// Converts prescription frequencies (1-0-1, OD, BD, TDS, QID, SOS) and food timings
/// into precise, personalized dose timestamps according to user meal times.
class ScheduleBuilder {
  final MealTimesConfig mealTimes;

  const ScheduleBuilder({this.mealTimes = const MealTimesConfig()});

  /// Builds the complete chronological dose slots for a confirmed medicine
  List<ScheduledDose> buildScheduleForMedicine({
    required String prescriptionId,
    required ParsedMedicine medicine,
    required DateTime startDate,
    required String transliteratedName,
    DateTime? customFirstDoseTime,
  }) {
    final freq = medicine.frequency.trim().toUpperCase();
    final timing = medicine.timing;
    final int days = medicine.durationDays ?? 5;

    // Handle SOS (as-needed) medicines
    if (freq == 'SOS' || freq.contains('AS NEEDED') || freq.contains('WHEN REQUIRED')) {
      return [
        ScheduledDose(
          id: 'dose_sos_${medicine.id}',
          prescriptionId: prescriptionId,
          medicineId: medicine.id,
          medicineName: medicine.name,
          transliteratedName: transliteratedName,
          doseAmount: medicine.dose,
          foodInstruction: _formatFoodTiming(timing),
          scheduledTimeUtc: startDate.toUtc(),
          category: TimeOfDayCategory.sos,
          isSos: true,
        ),
      ];
    }

    final List<ScheduledDose> allDoses = [];

    for (int dayIndex = 0; dayIndex < days; dayIndex++) {
      final currentDay = startDate.add(Duration(days: dayIndex));
      final List<_TimeSlot> daySlots = _calculateSlotsForFrequency(freq, timing, currentDay, customFirstDoseTime);

      for (int i = 0; i < daySlots.length; i++) {
        final slot = daySlots[i];
        allDoses.add(
          ScheduledDose(
            id: 'dose_${medicine.id}_d${dayIndex}_$i',
            prescriptionId: prescriptionId,
            medicineId: medicine.id,
            medicineName: medicine.name,
            transliteratedName: transliteratedName,
            doseAmount: medicine.dose,
            foodInstruction: _formatFoodTiming(timing),
            scheduledTimeUtc: slot.time.toUtc(),
            category: slot.category,
            status: DoseStatus.pending,
          ),
        );
      }
    }

    return allDoses;
  }

  List<_TimeSlot> _calculateSlotsForFrequency(
    String freq,
    String timing,
    DateTime baseDate,
    DateTime? firstDoseTime,
  ) {
    final List<_TimeSlot> slots = [];

    // Pattern 1: Dash patterns like "1-0-1", "1-1-1", "0-0-1", "1-0-0"
    if (RegExp(r'^\d-\d-\d(-\d)?$').hasMatch(freq)) {
      final parts = freq.split('-');
      if (parts[0] != '0') {
        slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.breakfastHour, mealTimes.breakfastMinute, timing), TimeOfDayCategory.morning));
      }
      if (parts[1] != '0') {
        slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.lunchHour, mealTimes.lunchMinute, timing), TimeOfDayCategory.afternoon));
      }
      if (parts[2] != '0') {
        slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.dinnerHour, mealTimes.dinnerMinute, timing), TimeOfDayCategory.night));
      }
      if (parts.length > 3 && parts[3] != '0') {
        slots.add(_TimeSlot(DateTime(baseDate.year, baseDate.month, baseDate.day, mealTimes.bedtimeHour, mealTimes.bedtimeMinute), TimeOfDayCategory.night));
      }
      return slots;
    }

    // Pattern 2: Medical standard abbreviations
    if (freq == 'OD' || freq == 'ONCE A DAY' || freq == 'DAILY') {
      slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.breakfastHour, mealTimes.breakfastMinute, timing), TimeOfDayCategory.morning));
    } else if (freq == 'BD' || freq == 'BID' || freq == 'TWICE A DAY') {
      slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.breakfastHour, mealTimes.breakfastMinute, timing), TimeOfDayCategory.morning));
      slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.dinnerHour, mealTimes.dinnerMinute, timing), TimeOfDayCategory.night));
    } else if (freq == 'TDS' || freq == 'TID' || freq == 'THRICE A DAY') {
      slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.breakfastHour, mealTimes.breakfastMinute, timing), TimeOfDayCategory.morning));
      slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.lunchHour, mealTimes.lunchMinute, timing), TimeOfDayCategory.afternoon));
      slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.dinnerHour, mealTimes.dinnerMinute, timing), TimeOfDayCategory.night));
    } else if (freq == 'QID' || freq == 'FOUR TIMES A DAY') {
      slots.add(_TimeSlot(DateTime(baseDate.year, baseDate.month, baseDate.day, 8, 0), TimeOfDayCategory.morning));
      slots.add(_TimeSlot(DateTime(baseDate.year, baseDate.month, baseDate.day, 12, 0), TimeOfDayCategory.afternoon));
      slots.add(_TimeSlot(DateTime(baseDate.year, baseDate.month, baseDate.day, 16, 0), TimeOfDayCategory.evening));
      slots.add(_TimeSlot(DateTime(baseDate.year, baseDate.month, baseDate.day, 20, 0), TimeOfDayCategory.night));
    } else if (freq.contains('EVERY 8 HOURS')) {
      final start = firstDoseTime ?? DateTime(baseDate.year, baseDate.month, baseDate.day, 8, 0);
      slots.add(_TimeSlot(DateTime(baseDate.year, baseDate.month, baseDate.day, start.hour, start.minute), TimeOfDayCategory.morning));
      slots.add(_TimeSlot(DateTime(baseDate.year, baseDate.month, baseDate.day, (start.hour + 8) % 24, start.minute), TimeOfDayCategory.afternoon));
      slots.add(_TimeSlot(DateTime(baseDate.year, baseDate.month, baseDate.day, (start.hour + 16) % 24, start.minute), TimeOfDayCategory.night));
    } else if (freq.contains('BEDTIME') || timing == 'bedtime') {
      slots.add(_TimeSlot(DateTime(baseDate.year, baseDate.month, baseDate.day, mealTimes.bedtimeHour, mealTimes.bedtimeMinute), TimeOfDayCategory.night));
    } else {
      // Safe fallback: twice daily
      slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.breakfastHour, mealTimes.breakfastMinute, timing), TimeOfDayCategory.morning));
      slots.add(_TimeSlot(_applyOffset(baseDate, mealTimes.dinnerHour, mealTimes.dinnerMinute, timing), TimeOfDayCategory.night));
    }

    return slots;
  }

  DateTime _applyOffset(DateTime base, int mealHour, int mealMinute, String timing) {
    final mealTime = DateTime(base.year, base.month, base.day, mealHour, mealMinute);

    switch (timing) {
      case 'before_food':
        return mealTime.subtract(const Duration(minutes: 30));
      case 'after_food':
        return mealTime.add(const Duration(minutes: 30));
      case 'empty_stomach':
        return mealTime.subtract(const Duration(hours: 1));
      case 'with_food':
      default:
        return mealTime;
    }
  }

  String _formatFoodTiming(String timing) {
    switch (timing) {
      case 'before_food': return '30 min before food';
      case 'after_food': return '30 min after food';
      case 'empty_stomach': return 'Empty stomach (1h before food)';
      case 'bedtime': return 'At bedtime';
      case 'with_food': return 'With food';
      default: return 'As directed';
    }
  }
}

class _TimeSlot {
  final DateTime time;
  final TimeOfDayCategory category;
  _TimeSlot(this.time, this.category);
}
