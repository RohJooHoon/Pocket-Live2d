import '../models/face_tracking_state.dart';
import '../models/live2d_parameter_state.dart';
import '../models/orientation_state.dart';

class Live2DTrackingConfig {
  const Live2DTrackingConfig({
    this.maxHeadX = 30,
    this.maxHeadY = 30,
    this.maxHeadZ = 15,
    this.maxBodyX = 10,
    this.eyeGain = 0.7,
    this.bodyGain = 0.25,
    this.trackingConfidenceThreshold = 0.35,
  });

  final double maxHeadX;
  final double maxHeadY;
  final double maxHeadZ;
  final double maxBodyX;
  final double eyeGain;
  final double bodyGain;
  final double trackingConfidenceThreshold;
}

class Live2DTrackingMapper {
  const Live2DTrackingMapper({
    this.config = const Live2DTrackingConfig(),
  });

  final Live2DTrackingConfig config;

  Live2DParameterState fromOrientation(OrientationState state) {
    final x = _normalized(state.x);
    final y = _normalized(state.y);
    final z = _normalized(state.z);

    return Live2DParameterState(
      angleX: x * config.maxHeadX,
      angleY: y * config.maxHeadY,
      angleZ: z * config.maxHeadZ,
      eyeBallX: _clampUnit(x * config.eyeGain),
      eyeBallY: _clampUnit(y * config.eyeGain),
      bodyAngleX: _clamp(x * config.maxBodyX, -config.maxBodyX, config.maxBodyX),
    );
  }

  Live2DParameterState fromFaceTracking(FaceTrackingState state) {
    if (!state.trackingConfidence.isFinite ||
        state.trackingConfidence < config.trackingConfidenceThreshold) {
      return const Live2DParameterState();
    }

    return Live2DParameterState(
      angleX: _clamp(state.headYaw, -config.maxHeadX, config.maxHeadX),
      angleY: _clamp(state.headPitch, -config.maxHeadY, config.maxHeadY),
      angleZ: _clamp(state.headRoll, -config.maxHeadZ, config.maxHeadZ),
      eyeBallX: _clampUnit(state.eyeLookX),
      eyeBallY: _clampUnit(state.eyeLookY),
      eyeLOpen: 1 - _clamp01(state.eyeBlinkLeft),
      eyeROpen: 1 - _clamp01(state.eyeBlinkRight),
      mouthOpenY: _clamp01(state.mouthOpen),
      mouthForm: _clampUnit(state.mouthForm),
      bodyAngleX: _clamp(
        state.headYaw * config.bodyGain,
        -config.maxBodyX,
        config.maxBodyX,
      ),
    );
  }

  double _normalized(double value) => _clampUnit(value);

  double _clamp01(double value) => _clamp(value, 0, 1);

  double _clampUnit(double value) => _clamp(value, -1, 1);

  double _clamp(double value, double min, double max) {
    if (!value.isFinite) return 0;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }
}
