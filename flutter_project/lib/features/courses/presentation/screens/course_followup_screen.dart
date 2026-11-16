import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/ui/medical_disclaimer_footer.dart';

enum CourseStatus { active, completingSoon, completed, stoppedEarly }

class CourseItem {
  final String id;
  final String medicineName;
  final String doctorName;
  final String clinicName;
  final String clinicPhone;
  final int totalDays;
  final int currentDay;
  final DateTime startDate;
  final DateTime endDate;
  final CourseStatus status;
  final String doctorNote;

  const CourseItem({
    required this.id,
    required this.medicineName,
    required this.doctorName,
    required this.clinicName,
    required this.clinicPhone,
    required this.totalDays,
    required this.currentDay,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.doctorNote,
  });
}

class CourseFollowupScreen extends StatefulWidget {
  const CourseFollowupScreen({super.key});

  @override
  State<CourseFollowupScreen> createState() => _CourseFollowupScreenState();
}

class _CourseFollowupScreenState extends State<CourseFollowupScreen> {
  final List<CourseItem> _courses = [
    CourseItem(
      id: 'c1',
      medicineName: 'Augmentin 625 Duo (Amoxicillin)',
      doctorName: 'Dr. Ramesh Kumar (MBBS, MD)',
      clinicName: 'Apollo Clinic, Indiranagar',
      clinicPhone: '+91 80 2525 1000',
      totalDays: 5,
      currentDay: 4,
      startDate: DateTime.now().subtract(const Duration(days: 3)),
      endDate: DateTime.now().add(const Duration(days: 1)),
      status: CourseStatus.completingSoon,
      doctorNote: 'Review in clinic after 5 days if fever recurs or chest congestion persists.',
    ),
    CourseItem(
      id: 'c2',
      medicineName: 'Pantocid 40 (Pantoprazole)',
      doctorName: 'Dr. Ramesh Kumar (MBBS, MD)',
      clinicName: 'Apollo Clinic, Indiranagar',
      clinicPhone: '+91 80 2525 1000',
      totalDays: 14,
      currentDay: 4,
      startDate: DateTime.now().subtract(const Duration(days: 3)),
      endDate: DateTime.now().add(const Duration(days: 10)),
      status: CourseStatus.active,
      doctorNote: 'Take 30m before breakfast every morning.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Medication Courses & Follow-up'),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            tooltip: 'Share Course Summary',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Course summary generated for WhatsApp export')),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 2-Day Revisit Alert Banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_month, color: Color(0xFFD97706), size: 36),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Follow-up Visit Due Soon',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF92400E),
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Augmentin course ends tomorrow. Your prescription advises a doctor review.',
                          style: TextStyle(fontSize: 12, color: Color(0xFFB45309)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            const Text(
              'Active Prescriptions',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),

            ..._courses.map((course) => _buildCourseCard(course)),

            const SizedBox(height: 20),
            // Doctor Visit Action Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.local_hospital, color: AppColors.primaryBlue),
                      SizedBox(width: 8),
                      Text(
                        'Follow-up Appointment',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Dr. Ramesh Kumar • Apollo Clinic',
                    style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Calling +91 80 2525 1000...')),
                            );
                          },
                          icon: const Icon(Icons.call, size: 16),
                          label: const Text('Call Clinic'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.primaryBlue,
                            side: const BorderSide(color: AppColors.primaryBlue),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Appointment reminder added to device calendar')),
                            );
                          },
                          icon: const Icon(Icons.event, size: 16),
                          label: const Text('Add Calendar'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primaryBlue,
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),
            const MedicalDisclaimerFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildCourseCard(CourseItem course) {
    final progress = (course.currentDay / course.totalDays).clamp(0.0, 1.0);
    final isCompletingSoon = course.status == CourseStatus.completingSoon;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCompletingSoon ? const Color(0xFFFBBF24) : const Color(0xFFE5E7EB),
          width: isCompletingSoon ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  course.medicineName,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              _buildStatusChip(course.status),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Prescribed by ${course.doctorName}',
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 14),

          // Progress indicator
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Day ${course.currentDay} of ${course.totalDays}',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              Text(
                '${(progress * 100).toInt()}% completed',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: const Color(0xFFE5E7EB),
              color: isCompletingSoon ? const Color(0xFFD97706) : AppColors.accentGreen,
              minHeight: 8,
            ),
          ),
          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF9FAFB),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.notes, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    course.doctorNote,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.3),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusChip(CourseStatus status) {
    Color bg;
    Color text;
    String label;

    switch (status) {
      case CourseStatus.active:
        bg = const Color(0xFFDEF7EC);
        text = const Color(0xFF03543F);
        label = 'Active';
        break;
      case CourseStatus.completingSoon:
        bg = const Color(0xFFFEF3C7);
        text = const Color(0xFF92400E);
        label = 'Ends Soon';
        break;
      case CourseStatus.completed:
        bg = const Color(0xFFE5E7EB);
        text = const Color(0xFF374151);
        label = 'Completed';
        break;
      case CourseStatus.stoppedEarly:
        bg = const Color(0xFFFDE8E8);
        text = const Color(0xFF9B1C1C);
        label = 'Stopped';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: text),
      ),
    );
  }
}
