import 'dart:async';

import 'package:flutter/services.dart';

import 'live2d_controller.dart';
import 'models/face_tracking_state.dart';
import 'models/live2d_capabilities.dart';
import 'models/live2d_parameter_state.dart';
import 'models/orientation_state.dart';

final class Live2DMethodChannel implements Live2DController {
  Live2DMethodChannel({
    MethodChannel? methodChannel,
    EventChannel? faceTrackingChannel,
    EventChannel? orientationChannel,
  })  : _methodChannel = methodChannel ?? const MethodChannel('pocket_live2d/live2d'),
        _faceTrackingChannel =
            faceTrackingChannel ?? const EventChannel('pocket_live2d/face_tracking'),
        _orientationChannel =
            orientationChannel ?? const EventChannel('pocket_live2d/orientation');

  final MethodChannel _methodChannel;
  final EventChannel _faceTrackingChannel;
  final EventChannel _orientationChannel;

  Stream<FaceTrackingState>? _faceTrackingStates;
  Stream<OrientationState>? _orientationStates;

  @override
  Stream<FaceTrackingState> get faceTrackingStates =>
      _faceTrackingStates ??= _faceTrackingChannel
          .receiveBroadcastStream()
          .where((event) => event is Map)
          .map((event) => FaceTrackingState.fromMap(event as Map<Object?, Object?>));

  @override
  Stream<OrientationState> get orientationStates =>
      _orientationStates ??= _orientationChannel
          .receiveBroadcastStream()
          .where((event) => event is Map)
          .map((event) => OrientationState.fromMap(event as Map<Object?, Object?>));

  @override
  Future<Live2DCapabilities> initialize() async {
    final map = await _methodChannel.invokeMapMethod<Object?, Object?>('initialize');
    return Live2DCapabilities.fromMap(map ?? const {});
  }

  @override
  Future<void> loadModel(String modelId) =>
      _methodChannel.invokeMethod<void>('loadModel', {'modelId': modelId});

  @override
  Future<void> playMotion(String group, {int? index}) =>
      _methodChannel.invokeMethod<void>('playMotion', {
        'group': group,
        if (index != null) 'index': index,
      });

  @override
  Future<void> setExpression(String expressionId) =>
      _methodChannel.invokeMethod<void>('setExpression', {
        'expressionId': expressionId,
      });

  @override
  Future<void> setMimicEnabled(bool enabled) =>
      _methodChannel.invokeMethod<void>('setMimicEnabled', {'enabled': enabled});

  @override
  Future<void> setGyroEnabled(bool enabled) =>
      _methodChannel.invokeMethod<void>('setGyroEnabled', {'enabled': enabled});

  @override
  Future<void> lookAt(double x, double y) =>
      _methodChannel.invokeMethod<void>('lookAt', {'x': x, 'y': y});

  @override
  Future<void> setParameters(Live2DParameterState state) =>
      _methodChannel.invokeMethod<void>('setParameters', state.toMap());

  @override
  Future<void> calibrate() => _methodChannel.invokeMethod<void>('calibrate');

  @override
  Future<void> setActive(bool active) =>
      _methodChannel.invokeMethod<void>('setActive', {'active': active});

  @override
  Future<void> dispose() => _methodChannel.invokeMethod<void>('dispose');
}
