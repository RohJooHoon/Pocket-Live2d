import 'package:flutter_test/flutter_test.dart';
import 'package:pocket_live2d/live2d/models/face_tracking_state.dart';
import 'package:pocket_live2d/live2d/models/orientation_state.dart';
import 'package:pocket_live2d/live2d/tracking/live2d_tracking_mapper.dart';

void main() {
  const mapper = Live2DTrackingMapper();

  group('Live2DTrackingMapper.fromOrientation', () {
    test('maps normalized gyro input to head eye and body ranges', () {
      final result = mapper.fromOrientation(
        const OrientationState(x: 0.5, y: -0.5, z: 1),
      );

      expect(result.angleX, 15);
      expect(result.angleY, -15);
      expect(result.angleZ, 15);
      expect(result.eyeBallX, closeTo(0.35, 0.0001));
      expect(result.eyeBallY, closeTo(-0.35, 0.0001));
      expect(result.bodyAngleX, 5);
    });

    test('clamps sensor input outside normalized range', () {
      final result = mapper.fromOrientation(
        const OrientationState(x: 3, y: -2, z: 2),
      );

      expect(result.angleX, 30);
      expect(result.angleY, -30);
      expect(result.angleZ, 15);
      expect(result.eyeBallX, 0.7);
      expect(result.eyeBallY, -0.7);
      expect(result.bodyAngleX, 10);
    });
  });

  group('Live2DTrackingMapper.fromFaceTracking', () {
    test('returns idle parameters when tracking confidence is too low', () {
      final result = mapper.fromFaceTracking(
        const FaceTrackingState(
          headYaw: 20,
          mouthOpen: 1,
          trackingConfidence: 0.2,
        ),
      );

      expect(result.angleX, 0);
      expect(result.mouthOpenY, 0);
      expect(result.eyeLOpen, 1);
    });

    test('maps face values and converts blink to eye-open values', () {
      final result = mapper.fromFaceTracking(
        const FaceTrackingState(
          headYaw: 12,
          headPitch: -8,
          headRoll: 5,
          eyeBlinkLeft: 1,
          eyeBlinkRight: 0.25,
          eyeLookX: 0.4,
          eyeLookY: -0.3,
          mouthOpen: 0.8,
          mouthForm: -0.5,
          trackingConfidence: 0.95,
        ),
      );

      expect(result.angleX, 12);
      expect(result.angleY, -8);
      expect(result.angleZ, 5);
      expect(result.eyeLOpen, 0);
      expect(result.eyeROpen, 0.75);
      expect(result.eyeBallX, 0.4);
      expect(result.eyeBallY, -0.3);
      expect(result.mouthOpenY, 0.8);
      expect(result.mouthForm, -0.5);
      expect(result.bodyAngleX, 3);
    });
  });
}
