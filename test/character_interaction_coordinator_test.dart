import 'package:flutter_test/flutter_test.dart';
import 'package:pocket_live2d/live2d/interaction/character_input_mode.dart';
import 'package:pocket_live2d/live2d/interaction/character_interaction_coordinator.dart';
import 'package:pocket_live2d/live2d/live2d_controller.dart';
import 'package:pocket_live2d/live2d/models/face_tracking_state.dart';
import 'package:pocket_live2d/live2d/models/live2d_capabilities.dart';
import 'package:pocket_live2d/live2d/models/live2d_parameter_state.dart';
import 'package:pocket_live2d/live2d/models/orientation_state.dart';

class _FakeLive2DController implements Live2DController {
  final List<String> calls = [];

  @override
  Stream<FaceTrackingState> get faceTrackingStates =>
      const Stream<FaceTrackingState>.empty();

  @override
  Stream<OrientationState> get orientationStates =>
      const Stream<OrientationState>.empty();

  @override
  Future<Live2DCapabilities> initialize() async {
    calls.add('initialize');
    return const Live2DCapabilities();
  }

  @override
  Future<void> setParameters(Live2DParameterState state) async {}
  @override
  Future<void> setActive(bool active) async {}
  @override
  Future<void> calibrate() async {}

  @override
  Future<void> loadModel(String modelId) async => calls.add('loadModel:$modelId');

  @override
  Future<void> lookAt(double x, double y) async => calls.add('lookAt:$x,$y');

  @override
  Future<void> playMotion(String group, {int? index}) async =>
      calls.add('playMotion:$group:${index ?? -1}');

  @override
  Future<void> setExpression(String expressionId) async =>
      calls.add('setExpression:$expressionId');

  @override
  Future<void> setGyroEnabled(bool enabled) async =>
      calls.add('gyro:$enabled');

  @override
  Future<void> setMimicEnabled(bool enabled) async =>
      calls.add('mimic:$enabled');

  @override
  Future<void> dispose() async => calls.add('dispose');
}

void main() {
  test('gyro mode disables mimic before enabling gyro', () async {
    final controller = _FakeLive2DController();
    final coordinator = CharacterInteractionCoordinator(controller);

    await coordinator.setMode(CharacterInputMode.gyro);

    expect(coordinator.mode, CharacterInputMode.gyro);
    expect(controller.calls, ['mimic:false', 'gyro:true']);
  });

  test('mimic mode disables gyro before enabling camera tracking', () async {
    final controller = _FakeLive2DController();
    final coordinator = CharacterInteractionCoordinator(controller);

    await coordinator.setMode(CharacterInputMode.mimic);

    expect(coordinator.mode, CharacterInputMode.mimic);
    expect(controller.calls, ['gyro:false', 'mimic:true']);
  });

  test('idle mode disables both active input sources', () async {
    final controller = _FakeLive2DController();
    final coordinator = CharacterInteractionCoordinator(controller);

    await coordinator.setMode(CharacterInputMode.idle);

    expect(coordinator.mode, CharacterInputMode.idle);
    expect(controller.calls, ['mimic:false', 'gyro:false']);
  });
}
