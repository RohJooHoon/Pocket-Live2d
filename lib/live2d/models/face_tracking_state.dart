import 'native_value.dart';

/// Head angles use degrees. Blink/open/confidence use 0..1; gaze uses -1..1.
class FaceTrackingState {
  const FaceTrackingState({
    this.headYaw = 0,
    this.headPitch = 0,
    this.headRoll = 0,
    this.eyeBlinkLeft = 0,
    this.eyeBlinkRight = 0,
    this.eyeLookX = 0,
    this.eyeLookY = 0,
    this.mouthOpen = 0,
    this.mouthForm = 0,
    this.browLeft = 0,
    this.browRight = 0,
    this.trackingConfidence = 0,
  });

  final double headYaw;
  final double headPitch;
  final double headRoll;
  final double eyeBlinkLeft;
  final double eyeBlinkRight;
  final double eyeLookX;
  final double eyeLookY;
  final double mouthOpen;
  final double mouthForm;
  final double browLeft;
  final double browRight;
  final double trackingConfidence;

  factory FaceTrackingState.fromMap(Map<Object?, Object?> map) {
    double value(String key) => nativeValue(map, key);

    return FaceTrackingState(
      headYaw: value('headYaw'),
      headPitch: value('headPitch'),
      headRoll: value('headRoll'),
      eyeBlinkLeft: value('eyeBlinkLeft'),
      eyeBlinkRight: value('eyeBlinkRight'),
      eyeLookX: value('eyeLookX'),
      eyeLookY: value('eyeLookY'),
      mouthOpen: value('mouthOpen'),
      mouthForm: value('mouthForm'),
      browLeft: value('browLeft'),
      browRight: value('browRight'),
      trackingConfidence: value('trackingConfidence'),
    );
  }
}
