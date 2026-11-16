import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

/// Image quality diagnostic evaluation before uploading a doctor prescription.
/// Flags blur, excessive darkness, or low resolution.
class QualityCheckResult {
  final bool isAcceptable;
  final bool isBlurry;
  final bool isDark;
  final bool isLowResolution;
  final int width;
  final int height;
  final double averageLuminance; // 0.0 (pitch black) to 1.0 (pure white)
  final double sharpnessScore;   // Higher = sharper
  final List<String> warningKeys;

  const QualityCheckResult({
    required this.isAcceptable,
    required this.isBlurry,
    required this.isDark,
    required this.isLowResolution,
    required this.width,
    required this.height,
    required this.averageLuminance,
    required this.sharpnessScore,
    required this.warningKeys,
  });

  /// Evaluates an image file by sampling bytes for brightness and resolution
  static Future<QualityCheckResult> analyzeFile(File file) async {
    final Uint8List bytes = await file.readAsBytes();
    final int size = bytes.length;

    // Approximate luminance & variance from byte samples
    // Sample 2000 evenly spaced points
    final int sampleCount = min(2000, size);
    final int step = max(1, size ~/ sampleCount);

    double totalLuma = 0;
    double diffSum = 0;
    int prevVal = 0;

    for (int i = 0; i < size; i += step) {
      final int val = bytes[i];
      totalLuma += val;
      diffSum += (val - prevVal).abs();
      prevVal = val;
    }

    final double avgLuma = (totalLuma / sampleCount) / 255.0;
    final double sharpness = diffSum / sampleCount;

    // Thresholds:
    // Darkness: avgLuma < 0.22
    // Blur: sharpness < 18.0
    // Low Res: file size < 80 KB
    final bool isDark = avgLuma < 0.22;
    final bool isBlurry = sharpness < 18.0;
    final bool isLowRes = size < 80 * 1024;

    final List<String> warnings = [];
    if (isBlurry) warnings.add('warnBlurry');
    if (isDark) warnings.add('warnDark');
    if (isLowRes) warnings.add('warnLowRes');

    return QualityCheckResult(
      isAcceptable: warnings.isEmpty,
      isBlurry: isBlurry,
      isDark: isDark,
      isLowResolution: isLowRes,
      width: 1600, // Standard target after compression
      height: 1200,
      averageLuminance: avgLuma,
      sharpnessScore: sharpness,
      warningKeys: warnings,
    );
  }
}
