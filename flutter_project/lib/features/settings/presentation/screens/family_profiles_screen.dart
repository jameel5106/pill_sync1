import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class FamilyProfile {
  final String id;
  final String name;
  final String relation;
  final int age;
  final String avatarColorHex;
  final bool isPrimary;
  final bool caregiverAlerts;

  const FamilyProfile({
    required this.id,
    required this.name,
    required this.relation,
    required this.age,
    required this.avatarColorHex,
    this.isPrimary = false,
    this.caregiverAlerts = false,
  });
}

class FamilyProfilesScreen extends StatefulWidget {
  const FamilyProfilesScreen({super.key});

  @override
  State<FamilyProfilesScreen> createState() => _FamilyProfilesScreenState();
}

class _FamilyProfilesScreenState extends State<FamilyProfilesScreen> {
  String _selectedProfileId = 'p_me';

  final List<FamilyProfile> _profiles = [
    const FamilyProfile(
      id: 'p_me',
      name: 'Dr. Ramesh Kumar',
      relation: 'Self (Primary)',
      age: 42,
      avatarColorHex: '0xFF1E88E5',
      isPrimary: true,
      caregiverAlerts: false,
    ),
    const FamilyProfile(
      id: 'p_mom',
      name: 'Kavitha Kumar',
      relation: 'Mother',
      age: 68,
      avatarColorHex: '0xFF8B5CF6',
      caregiverAlerts: true,
    ),
    const FamilyProfile(
      id: 'p_dad',
      name: 'V. S. Kumar',
      relation: 'Father',
      age: 72,
      avatarColorHex: '0xFF10B981',
      caregiverAlerts: true,
    ),
    const FamilyProfile(
      id: 'p_child',
      name: 'Aarav Kumar',
      relation: 'Son',
      age: 10,
      avatarColorHex: '0xFFF59E0B',
      caregiverAlerts: false,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Profiles & Caregiver'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add),
            tooltip: 'Add member',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Add family member modal opened')),
              );
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Active Profile Switcher Note
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: const Row(
              children: [
                Icon(Icons.people_alt, color: AppColors.primaryBlue),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'PillSync lets you manage separate prescription schedules for elderly parents and children with isolated reminders.',
                    style: TextStyle(fontSize: 13, color: Color(0xFF1E40AF)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          const Text(
            'Select Active Profile',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),

          ..._profiles.map((profile) {
            final isSelected = profile.id == _selectedProfileId;
            final color = Color(int.parse(profile.avatarColorHex));

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isSelected ? AppColors.accentGreen : const Color(0xFFE5E7EB),
                  width: isSelected ? 2 : 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: ListTile(
                onTap: () {
                  setState(() {
                    _selectedProfileId = profile.id;
                  });
                },
                leading: CircleAvatar(
                  backgroundColor: color.withOpacity(0.15),
                  child: Text(
                    profile.name.substring(0, 1),
                    style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 18),
                  ),
                ),
                title: Row(
                  children: [
                    Text(
                      profile.name,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    if (profile.isPrimary) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'DEFAULT',
                          style: TextStyle(fontSize: 10, color: AppColors.primaryBlue, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ],
                ),
                subtitle: Text(
                  '${profile.relation} • Age ${profile.age}${profile.caregiverAlerts ? ' • Caregiver alerts ON' : ''}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                trailing: isSelected
                    ? const Icon(Icons.check_circle, color: AppColors.accentGreen)
                    : const Icon(Icons.radio_button_unchecked, color: Colors.grey),
              ),
            );
          }),

          const SizedBox(height: 20),
          // Caregiver Mode Feature Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.notifications_active, color: AppColors.accentGreen),
                    SizedBox(width: 8),
                    Text(
                      'Caregiver Mode',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Receive an alert if an elderly parent misses a critical dose by more than 45 minutes.',
                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: true,
                  activeColor: AppColors.accentGreen,
                  title: const Text('Send SMS / WhatsApp alert on missed doses', style: TextStyle(fontSize: 13)),
                  onChanged: (val) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Caregiver notification preference updated: $val')),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
