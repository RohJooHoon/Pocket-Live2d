import 'dart:async';

import 'package:flutter/services.dart';
import 'package:pocket_live2d/live2d/live2d_controller.dart';
import 'package:pocket_live2d/live2d/models/face_tracking_state.dart';
import 'package:pocket_live2d/live2d/models/live2d_capabilities.dart';
import 'package:pocket_live2d/live2d/models/live2d_parameter_state.dart';
import 'package:pocket_live2d/live2d/models/orientation_state.dart';

class FakeLive2DController implements Live2DController {
  final orientation = StreamController<OrientationState>.broadcast();
  final sentParameters = <Live2DParameterState>[];
  final activeCalls = <bool>[];
  Completer<void>? parameterGate;
  bool failGyro = false;
  bool disposed = false;
  int parameterCalls = 0;
  int concurrentCalls = 0;
  int maxConcurrentCalls = 0;

  @override
  Stream<FaceTrackingState> get faceTrackingStates => const Stream.empty();
  @override
  Stream<OrientationState> get orientationStates => orientation.stream;
  @override
  Future<Live2DCapabilities> initialize() async => const Live2DCapabilities(nativeSurface: true, gyro: true);
  @override
  Future<void> setGyroEnabled(bool enabled) async {
    if (enabled && failGyro) throw PlatformException(code: 'sensor_unavailable');
  }
  @override
  Future<void> setParameters(Live2DParameterState state) async {
    parameterCalls++;
    concurrentCalls++;
    if (concurrentCalls > maxConcurrentCalls) maxConcurrentCalls = concurrentCalls;
    sentParameters.add(state);
    await parameterGate?.future;
    concurrentCalls--;
  }
  @override
  Future<void> setActive(bool active) async => activeCalls.add(active);
  @override
  Future<void> calibrate() async {}
  @override
  Future<void> lookAt(double x, double y) async {}
  @override
  Future<void> loadModel(String modelId) async {}
  @override
  Future<void> playMotion(String group, {int? index}) async {}
  @override
  Future<void> setExpression(String expressionId) async {}
  @override
  Future<void> setMimicEnabled(bool enabled) async {}
  @override
  Future<void> dispose() async {
    disposed = true;
    await orientation.close();
  }
}
