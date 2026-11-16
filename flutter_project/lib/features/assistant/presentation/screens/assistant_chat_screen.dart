import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/ui/medical_disclaimer_footer.dart';
import '../../domain/safety_guard.dart';
import 'emergency_screen.dart';

class ChatMessage {
  final String text;
  final bool isUser;
  final DateTime timestamp;
  final bool isEmergencyTrigger;

  const ChatMessage({
    required this.text,
    required this.isUser,
    required this.timestamp,
    this.isEmergencyTrigger = false,
  });
}

class AssistantChatScreen extends ConsumerStatefulWidget {
  const AssistantChatScreen({super.key});

  @override
  ConsumerState<AssistantChatScreen> createState() => _AssistantChatScreenState();
}

class _AssistantChatScreenState extends ConsumerState<AssistantChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isGenerating = false;

  final List<ChatMessage> _messages = [
    ChatMessage(
      text: 'Namaste! I am your PillSync Safe Assistant. I can explain instructions on your confirmed prescriptions, meal timings, and general precautions in simple terms.\n\n'
          '⚠️ Please note: I cannot diagnose conditions, alter dosages, or tell you to stop prescribed medications. In serious discomfort, call 112 immediately.',
      isUser: false,
      timestamp: DateTime.now().subtract(const Duration(minutes: 5)),
    ),
  ];

  final List<String> _quickSuggestions = [
    'Should I take Augmentin with or after food?',
    'What if I feel mild drowsiness after Cetirizine?',
    'Why is Pantoprazole taken before breakfast?',
    'Can I crush this tablet if it is hard to swallow?',
  ];

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _handleSubmitted(String text) async {
    final query = text.trim();
    if (query.isEmpty) return;

    _textController.clear();
    setState(() {
      _messages.add(ChatMessage(
        text: query,
        isUser: true,
        timestamp: DateTime.now(),
      ));
    });
    _scrollToBottom();

    // 1. Evaluate safety guard across 7 languages
    final safetyCheck = SafetyGuard.evaluateInput(query);
    if (safetyCheck.isEmergency) {
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => EmergencyScreen(
            triggeredSymptom: safetyCheck.matchedKeyword,
            detectedLanguage: safetyCheck.detectedLanguage,
          ),
        ),
      );
      setState(() {
        _messages.add(ChatMessage(
          text: '⚠️ EMERGENCY DETECTED: Symptoms like "${safetyCheck.matchedKeyword}" require urgent medical attention. Directing you to emergency services (112 / 108).',
          isUser: false,
          timestamp: DateTime.now(),
          isEmergencyTrigger: true,
        ));
      });
      _scrollToBottom();
      return;
    }

    // 2. Safe LLM simulation adhering to medical guidance
    setState(() {
      _isGenerating = true;
    });

    await Future.delayed(const Duration(milliseconds: 900));

    String botResponse = '';
    final lower = query.toLowerCase();

    if (lower.contains('pantoprazole') || lower.contains('before breakfast') || lower.contains('empty stomach')) {
      botResponse = 'Pantoprazole (Pantocid 40) is an acid reducer. Doctors usually recommend taking it 30 minutes before your first meal (breakfast) on an empty stomach. This allows the medicine to block stomach acid production before your food triggers it.\n\n*Always follow the specific instructions on your prescription.*';
    } else if (lower.contains('augmentin') || lower.contains('with or after food') || lower.contains('antibiotic')) {
      botResponse = 'Augmentin 625 Duo (Amoxicillin + Clavulanate) is an antibiotic. It is best taken at the start of a meal or immediately after food. Taking it with food helps protect your stomach and enhances absorption.\n\nBe sure to finish the full 5-day course unless your doctor advises otherwise.';
    } else if (lower.contains('cetirizine') || lower.contains('drowsy') || lower.contains('sleepy')) {
      botResponse = 'Mild drowsiness or dry mouth is a recognized side effect of antihistamines like Cetirizine. That is why it is usually scheduled at bedtime (10:00 PM). Avoid driving or operating machinery if you feel drowsy. If the drowsiness is severe or persists, notify your prescribing doctor.';
    } else if (lower.contains('crush') || lower.contains('break')) {
      botResponse = 'Certain tablets have special coatings (like enteric-coated or extended-release) that can be destroyed by crushing, causing stomach irritation or improper absorption. Always check with your pharmacist before crushing or splitting any tablet.';
    } else {
      botResponse = 'Thank you for your question. Your confirmed medicines are designed to be taken according to your scheduled timeline. Remember never to alter doses or skip days without consulting your doctor.\n\nIf you experience unusual discomfort, please reach out to your clinic or pharmacist.';
    }

    if (mounted) {
      setState(() {
        _isGenerating = false;
        _messages.add(ChatMessage(
          text: botResponse,
          isUser: false,
          timestamp: DateTime.now(),
        ));
      });
      _scrollToBottom();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.health_and_safety, color: AppColors.accentGreen, size: 22),
            SizedBox(width: 8),
            Text('Prescription Assistant'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.emergency_outlined, color: AppColors.error),
            tooltip: 'Emergency Services',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const EmergencyScreen()),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Safety alert banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFFEFF6FF),
            child: const Row(
              children: [
                Icon(Icons.info_outline, size: 16, color: AppColors.primaryBlue),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'AI explanation companion. Cannot diagnose or change prescriptions.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF), fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),

          // Chat messages list
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                return _buildMessageBubble(msg);
              },
            ),
          ),

          if (_isGenerating)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryBlue),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'PillSync is checking medical guidelines...',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontStyle: FontStyle.italic),
                  ),
                ],
              ),
            ),

          // Quick prompts horizontal bar
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _quickSuggestions.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final suggestion = _quickSuggestions[index];
                return ActionChip(
                  label: Text(
                    suggestion,
                    style: const TextStyle(fontSize: 12, color: AppColors.primaryBlue),
                  ),
                  backgroundColor: const Color(0xFFEBF5FF),
                  side: BorderSide(color: AppColors.primaryBlue.withOpacity(0.3)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  onPressed: () => _handleSubmitted(suggestion),
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // Input field
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 4,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      decoration: InputDecoration(
                        hintText: 'Ask about food timings or side effects...',
                        hintStyle: TextStyle(fontSize: 14, color: Colors.grey.shade400),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        filled: true,
                        fillColor: const Color(0xFFF9FAFB),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: Colors.grey.shade300),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: Colors.grey.shade300),
                        ),
                      ),
                      onSubmitted: _handleSubmitted,
                    ),
                  ),
                  const SizedBox(width: 8),
                  CircleAvatar(
                    backgroundColor: AppColors.accentGreen,
                    child: IconButton(
                      icon: const Icon(Icons.send, color: Colors.white, size: 18),
                      onPressed: () => _handleSubmitted(_textController.text),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const MedicalDisclaimerFooter(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg) {
    return Align(
      alignment: msg.isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: msg.isUser
              ? AppColors.primaryBlue
              : (msg.isEmergencyTrigger ? const Color(0xFFFEE2E2) : const Color(0xFFF3F4F6)),
          borderRadius: BorderRadius.circular(16).copyWith(
            bottomRight: msg.isUser ? const Radius.circular(0) : const Radius.circular(16),
            bottomLeft: !msg.isUser ? const Radius.circular(0) : const Radius.circular(16),
          ),
          border: msg.isEmergencyTrigger ? Border.all(color: AppColors.error, width: 1.5) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              msg.text,
              style: TextStyle(
                fontSize: 14,
                height: 1.45,
                color: msg.isUser
                    ? Colors.white
                    : (msg.isEmergencyTrigger ? const Color(0xFF991B1B) : AppColors.textPrimary),
                fontWeight: msg.isEmergencyTrigger ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.bottomRight,
              child: Text(
                '${msg.timestamp.hour.toString().padLeft(2, '0')}:${msg.timestamp.minute.toString().padLeft(2, '0')}',
                style: TextStyle(
                  fontSize: 10,
                  color: msg.isUser ? Colors.white70 : Colors.grey.shade500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
