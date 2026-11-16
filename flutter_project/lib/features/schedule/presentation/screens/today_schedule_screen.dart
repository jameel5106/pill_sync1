import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/ui/medical_disclaimer_footer.dart';
import '../../domain/schedule_models.dart';

class TodayScheduleScreen extends StatefulWidget {
  const TodayScheduleScreen({super.key});

  @override
  State<TodayScheduleScreen> createState() => _TodayScheduleScreenState();
}

class _TodayScheduleScreenState extends State<TodayScheduleScreen> {
  // Demo doses for today
  List<ScheduledDose> _doses = [
    ScheduledDose(
      id: 'dose_1',
      prescriptionId: 'rx_demo',
      medicineName: 'Pantocid 40 (Pantoprazole)',
      doseAmount: '1 Tablet',
      scheduledTime: DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day, 7, 30),
      slot: DoseSlot.morning,
      instructions: '30m before breakfast (Empty stomach)',
      status: DoseStatus.taken,
    ),
    ScheduledDose(
      id: 'dose_2',
      prescriptionId: 'rx_demo',
      medicineName: 'Augmentin 625 Duo (Amoxicillin)',
      doseAmount: '1 Tablet',
      scheduledTime: DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day, 8, 30),
      slot: DoseSlot.morning,
      instructions: 'Immediately after breakfast with water',
      status: DoseStatus.pending,
    ),
    ScheduledDose(
      id: 'dose_3',
      prescriptionId: 'rx_demo',
      medicineName: 'Augmentin 625 Duo (Amoxicillin)',
      doseAmount: '1 Tablet',
      scheduledTime: DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day, 20, 30),
      slot: DoseSlot.night,
      instructions: 'After dinner with a full glass of water',
      status: DoseStatus.pending,
    ),
    ScheduledDose(
      id: 'dose_4',
      prescriptionId: 'rx_demo',
      medicineName: 'Cetzine 10 (Cetirizine)',
      doseAmount: '1 Tablet',
      scheduledTime: DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day, 22, 0),
      slot: DoseSlot.bedtime,
      instructions: 'At bedtime (May cause mild drowsiness)',
      status: DoseStatus.pending,
    ),
  ];

  // Undo handling state (10s timer)
  ScheduledDose? _lastModifiedDose;
  DoseStatus? _previousStatus;
  Timer? _undoTimer;
  int _undoCountdown = 10;

  void _markDose(String id, DoseStatus newStatus) {
    final index = _doses.indexWhere((d) => d.id == id);
    if (index == -1) return;

    final originalDose = _doses[index];
    _previousStatus = originalDose.status;
    _lastModifiedDose = originalDose;

    setState(() {
      _doses[index] = ScheduledDose(
        id: originalDose.id,
        prescriptionId: originalDose.prescriptionId,
        medicineName: originalDose.medicineName,
        doseAmount: originalDose.doseAmount,
        scheduledTime: originalDose.scheduledTime,
        slot: originalDose.slot,
        instructions: originalDose.instructions,
        status: newStatus,
      );
      _undoCountdown = 10;
    });

    _undoTimer?.cancel();
    _undoTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_undoCountdown > 1) {
          _undoCountdown--;
        } else {
          _lastModifiedDose = null;
          timer.cancel();
        }
      });
    });
  }

  void _performUndo() {
    if (_lastModifiedDose == null || _previousStatus == null) return;
    final index = _doses.indexWhere((d) => d.id == _lastModifiedDose!.id);
    if (index != null && index >= 0) {
      setState(() {
        _doses[index] = ScheduledDose(
          id: _lastModifiedDose!.id,
          prescriptionId: _lastModifiedDose!.prescriptionId,
          medicineName: _lastModifiedDose!.medicineName,
          doseAmount: _lastModifiedDose!.doseAmount,
          scheduledTime: _lastModifiedDose!.scheduledTime,
          slot: _lastModifiedDose!.slot,
          instructions: _lastModifiedDose!.instructions,
          status: _previousStatus!,
        );
        _lastModifiedDose = null;
      });
    }
    _undoTimer?.cancel();
  }

  @override
  void dispose() {
    _undoTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final takenCount = _doses.where((d) => d.status == DoseStatus.taken).length;
    final totalCount = _doses.length;
    final progress = totalCount > 0 ? (takenCount / totalCount) : 0.0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Today\'s Medicines'),
        actions: [
          IconButton(
            icon: const Icon(Icons.alarm_on),
            tooltip: 'Reminder settings',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('All reminders synced with system alarm clock')),
              );
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Header Progress Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primaryBlue, Color(0xFF1565C0)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primaryBlue.withOpacity(0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Today\'s Adherence',
                          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          '$takenCount of $totalCount taken',
                          style: const TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: progress,
                        backgroundColor: Colors.white24,
                        color: AppColors.accentGreen,
                        minHeight: 8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      progress >= 1.0 ? '🎉 Great job! All doses completed today.' : 'Keep up the good routine.',
                      style: const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Morning Slot
              _buildSlotSection('Morning', '07:00 - 11:00 AM', DoseSlot.morning, Icons.wb_sunny_outlined),
              // Afternoon Slot
              _buildSlotSection('Afternoon', '12:00 - 03:00 PM', DoseSlot.afternoon, Icons.wb_sunny),
              // Evening Slot
              _buildSlotSection('Evening', '05:00 - 07:00 PM', DoseSlot.evening, Icons.coffee),
              // Night Slot
              _buildSlotSection('Night / Bedtime', '08:00 - 11:00 PM', DoseSlot.night, Icons.nightlight_round),

              const SizedBox(height: 40),
              const MedicalDisclaimerFooter(),
            ],
          ),

          // 10-Second Floating Undo Banner
          if (_lastModifiedDose != null)
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Material(
                elevation: 8,
                borderRadius: BorderRadius.circular(12),
                color: const Color(0xFF1F2937),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      const Icon(Icons.info, color: AppColors.accentGreen, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Updated "${_lastModifiedDose!.medicineName.split(' ')[0]}" ($_undoCountdown s)',
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                        ),
                      ),
                      TextButton(
                        onPressed: _performUndo,
                        child: const Text(
                          'UNDO',
                          style: TextStyle(color: Color(0xFF6EE7B7), fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSlotSection(String title, String timeRange, DoseSlot slot, IconData icon) {
    final slotDoses = _doses.where((d) => d.slot == slot || (slot == DoseSlot.night && d.slot == DoseSlot.bedtime)).toList();

    if (slotDoses.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: AppColors.primaryBlue),
            const SizedBox(width: 6),
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
            const SizedBox(width: 8),
            Text(
              timeRange,
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ...slotDoses.map((dose) => _buildDoseCard(dose)),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildDoseCard(ScheduledDose dose) {
    final isTaken = dose.status == DoseStatus.taken;
    final isSkipped = dose.status == DoseStatus.skipped;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isTaken ? const Color(0xFFF0FDF4) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isTaken
              ? AppColors.accentGreen.withOpacity(0.5)
              : isSkipped
                  ? Colors.grey.shade300
                  : const Color(0xFFE5E7EB),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Time badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: isTaken ? AppColors.accentGreen.withOpacity(0.12) : const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: [
                Text(
                  '${dose.scheduledTime.hour.toString().padLeft(2, '0')}:${dose.scheduledTime.minute.toString().padLeft(2, '0')}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isTaken ? AppColors.accentGreen : AppColors.primaryBlue,
                  ),
                ),
                Text(
                  dose.scheduledTime.hour >= 12 ? 'PM' : 'AM',
                  style: TextStyle(
                    fontSize: 10,
                    color: isTaken ? AppColors.accentGreen : AppColors.primaryBlue,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),

          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dose.medicineName,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    decoration: isTaken ? TextDecoration.lineThrough : null,
                    color: isTaken ? Colors.grey.shade600 : AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${dose.doseAmount} • ${dose.instructions}',
                  style: TextStyle(
                    fontSize: 12,
                    color: isTaken ? Colors.grey.shade500 : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),

          // 1-tap Actions
          if (isTaken)
            IconButton(
              icon: const Icon(Icons.check_circle, color: AppColors.accentGreen, size: 28),
              onPressed: () => _markDose(dose.id, DoseStatus.pending),
              tooltip: 'Revert to pending',
            )
          else
            Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.grey, size: 20),
                  onPressed: () => _markDose(dose.id, DoseStatus.skipped),
                  tooltip: 'Skip dose',
                ),
                ElevatedButton(
                  onPressed: () => _markDose(dose.id, DoseStatus.taken),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accentGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    minimumSize: const Size(60, 36),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Take'),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
