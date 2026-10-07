import 'package:flutter_test/flutter_test.dart';
import 'package:pocket_live2d/live2d/models/face_tracking_state.dart';
import 'package:pocket_live2d/live2d/models/orientation_state.dart';

void main() {
  test('FaceTrackingState parses native values', () {
    final state = FaceTrackingState.fromMap({
      'headYaw': 0.5,
      'eyeBlinkLeft': 1,
      'mouthOpen': 0.75,
      'trackingConfidence': 0.9,
    });

    expect(state.headYaw, 0.5);
    expect(state.eyeBlinkLeft, 1.0);
    expect(state.mouthOpen, 0.75);
    expect(state.trackingConfidence, 0.9);
    expect(state.headPitch, 0.0);
  });

  test('OrientationState parses native values', () {
    final state = OrientationState.fromMap({
      'x': -0.25,
      'y': 0.5,
      'z': 1,
    });

    expect(state.x, -0.25);
    expect(state.y, 0.5);
    expect(state.z, 1.0);
  });
}
