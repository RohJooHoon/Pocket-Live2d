import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:motionmate/live2d/interaction/character_input_mode.dart';
import 'package:motionmate/live2d/interaction/character_interaction_coordinator.dart';
import 'package:motionmate/live2d/live2d_controller.dart';
import 'package:motionmate/live2d/models/face_tracking_state.dart';
import 'package:motionmate/live2d/models/orientation_state.dart';

class _FakeLive2DController implements Live2DController {
  final List<String> calls = [];
  String? failOnCall;
  Completer<void>? mimicStartup;

  @override
  Stream<FaceTrackingState> get faceTrackingStates =>
      const Stream<FaceTrackingState>.empty();

  @override
  Stream<OrientationState> get orientationStates =>
      const Stream<OrientationState>.empty();

  @override
  Future<void> initialize() async => calls.add('initialize');

  @override
  Future<void> loadModel(String modelId) async => calls.add('loadModel:$modelId');

  @override
  Future<void> lookAt(double x, double y, {bool active = true}) async => calls.add('lookAt:$x,$y');

  @override
  Future<void> tapAt(double x, double y) async {}

  @override
  Future<void> setWallpaper({String modelId = 'mark'}) async {}

  @override
  Future<void> playMotion(String group, {int? index}) async =>
      calls.add('playMotion:$group:${index ?? -1}');

  @override
  Future<void> setExpression(String expressionId) async =>
      calls.add('setExpression:$expressionId');

  @override
  Future<void> setGyroEnabled(bool enabled) async {
    await _record('gyro:$enabled');
  }

  @override
  Future<void> setMimicEnabled(bool enabled) async {
    await _record('mimic:$enabled');
    if (enabled && mimicStartup != null) await mimicStartup!.future;
    if (!enabled && mimicStartup != null && !mimicStartup!.isCompleted) {
      mimicStartup!.completeError(StateError('startup cancelled'));
    }
  }

  Future<void> _record(String call) async {
    calls.add(call);
    if (failOnCall == call) {
      failOnCall = null;
      throw StateError('forced failure: $call');
    }
  }

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

  test('idle request is a no-op when already idle', () async {
    final controller = _FakeLive2DController();
    final coordinator = CharacterInteractionCoordinator(controller);

    await coordinator.setMode(CharacterInputMode.idle);

    expect(coordinator.mode, CharacterInputMode.idle);
    expect(controller.calls, isEmpty);
  });

  test('failed mimic transition restores the previous gyro mode', () async {
    final controller = _FakeLive2DController();
    final coordinator = CharacterInteractionCoordinator(controller);

    await coordinator.setMode(CharacterInputMode.gyro);
    controller.calls.clear();
    controller.failOnCall = 'mimic:true';

    await expectLater(
      coordinator.setMode(CharacterInputMode.mimic),
      throwsStateError,
    );

    expect(coordinator.mode, CharacterInputMode.gyro);
    expect(
      controller.calls,
      ['gyro:false', 'mimic:true', 'mimic:false', 'gyro:true'],
    );
  });
  test('concurrent mode requests are serialized', () async {
    final controller = _FakeLive2DController();
    final coordinator = CharacterInteractionCoordinator(controller);
    final first = coordinator.setMode(CharacterInputMode.gyro);
    final second = coordinator.setMode(CharacterInputMode.mimic);
    await Future.wait([first, second]);
    expect(coordinator.mode, CharacterInputMode.mimic);
    expect(controller.calls, ['mimic:false', 'gyro:true', 'gyro:false', 'mimic:true']);
  });

  test('stop cancels pending camera startup and ends idle', () async {
    final controller = _FakeLive2DController()..mimicStartup = Completer<void>();
    final coordinator = CharacterInteractionCoordinator(controller);
    final startup = coordinator.setMode(CharacterInputMode.mimic);
    final startupFailure = expectLater(startup, throwsStateError);
    await Future<void>.delayed(Duration.zero);
    expect(controller.calls.last, 'mimic:true');
    await coordinator.stop();
    await startupFailure;
    expect(coordinator.mode, CharacterInputMode.idle);
    expect(controller.calls.last, 'gyro:false');
  });

}
