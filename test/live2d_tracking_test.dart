import 'package:flutter_test/flutter_test.dart';
import 'package:pocket_live2d/live2d/models/face_tracking_state.dart';
import 'package:pocket_live2d/live2d/models/live2d_parameter_state.dart';
import 'package:pocket_live2d/live2d/models/orientation_state.dart';
import 'package:pocket_live2d/live2d/tracking/live2d_parameter_smoother.dart';
import 'package:pocket_live2d/live2d/tracking/live2d_tracking_mapper.dart';
import 'package:pocket_live2d/live2d/tracking/orientation_filter.dart';

void main() {
  const mapper = Live2DTrackingMapper();

  test('sensor noise is neutral, and full tilt reaches bounded limits', () {
    final filter = OrientationFilter(config: const OrientationFilterConfig(deadZone: 0.04, smoothingFactor: 1));
    expect(mapper.fromOrientation(filter.update(const OrientationState(x: 0.02))).angleX, 0);
    final state = mapper.fromOrientation(const OrientationState(x: 10, y: -10));
    expect(state.angleX, 30);
    expect(state.angleY, -30);
    expect(state.bodyAngleX, 10);
    expect(state.eyeBallX, 0.7);
  });

  test('native malformed and nonfinite samples remain finite', () {
    final input = OrientationState.fromMap({'x': 'bad', 'y': double.nan, 'z': double.infinity});
    final output = mapper.fromOrientation(input);
    expect(output.toMap().values.every((value) => value.isFinite), isTrue);
    expect(output.angleX, 0);
    expect(output.angleY, 0);
    expect(output.angleZ, 0);
  });

  test('face loss returns to open eyes and neutral head', () {
    final state = mapper.fromFaceTracking(const FaceTrackingState(
      headYaw: 20, eyeBlinkLeft: 1, mouthOpen: 1, trackingConfidence: 0.1,
    ));
    expect(state.angleX, 0);
    expect(state.eyeLOpen, 1);
    expect(state.mouthOpenY, 0);
  });

  test('smoothing response is stable across different frame rates', () {
    const target = Live2DParameterState(angleX: 30, eyeBallX: 1, bodyAngleX: 10);
    final fast = Live2DParameterSmoother();
    final slow = Live2DParameterSmoother();
    late Live2DParameterState fastState;
    late Live2DParameterState slowState;
    for (var i = 0; i < 20; i++) {
      fastState = fast.step(target, const Duration(milliseconds: 10));
    }
    for (var i = 0; i < 10; i++) {
      slowState = slow.step(target, const Duration(milliseconds: 20));
    }
    expect(fastState.angleX, closeTo(slowState.angleX, 1e-10));
    expect(fastState.eyeBallX, closeTo(slowState.eyeBallX, 1e-10));
    expect(fastState.bodyAngleX, closeTo(slowState.bodyAngleX, 1e-10));
    expect(fastState.eyeBallX, greaterThan(fastState.angleX / 30));
    expect(fastState.angleX / 30, greaterThan(fastState.bodyAngleX / 10));
  });
}
