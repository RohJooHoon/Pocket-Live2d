import 'dart:async';

import 'package:flutter/services.dart';
import 'package:pocket_live2d_native/pocket_live2d_native.dart';

import 'live2d_controller.dart';
import 'models/face_tracking_state.dart';
import 'models/orientation_state.dart';

final class Live2DMethodChannel implements Live2DController {
  Live2DMethodChannel({
    MethodChannel? methodChannel,
    EventChannel? faceTrackingChannel,
    EventChannel? orientationChannel,
  })  : _methodChannel = methodChannel ??
            const MethodChannel(PocketLive2DNative.methodChannel),
        _faceTrackingChannel = faceTrackingChannel ??
            const EventChannel(PocketLive2DNative.faceTrackingEventChannel),
        _orientationChannel = orientationChannel ??
            const EventChannel(PocketLive2DNative.orientationEventChannel);

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
          .map((event) => FaceTrackingState.fromMap(event as Map<Object?, Object?>))
          .asBroadcastStream();

  @override
  Stream<OrientationState> get orientationStates =>
      _orientationStates ??= _orientationChannel
          .receiveBroadcastStream()
          .where((event) => event is Map)
          .map((event) => OrientationState.fromMap(event as Map<Object?, Object?>))
          .asBroadcastStream();

  @override
  Future<void> initialize() => _methodChannel.invokeMethod<void>('initialize');

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
  Future<void> lookAt(double x, double y, {bool active = true}) =>
      _methodChannel.invokeMethod<void>('lookAt', {'x': x, 'y': y, if (!active) 'active': false});

  Stream<Map<Object?, Object?>> get rendererStates => const EventChannel(
        'pocket_live2d/status',
      ).receiveBroadcastStream().where((event) => event is Map)
          .map((event) => Map<Object?, Object?>.from(event as Map));

  @override
  Future<void> tapAt(double x, double y) =>
      _methodChannel.invokeMethod<void>('tapAt', {'x': x, 'y': y});

  @override
  Future<void> setWallpaper({String modelId = 'mark'}) =>
      _methodChannel.invokeMethod<void>('setWallpaper', {'modelId': modelId});

  @override
  Future<void> dispose() => _methodChannel.invokeMethod<void>('dispose');
}
