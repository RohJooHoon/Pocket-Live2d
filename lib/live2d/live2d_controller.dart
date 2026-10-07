import 'models/face_tracking_state.dart';
import 'models/live2d_capabilities.dart';
import 'models/live2d_parameter_state.dart';
import 'models/orientation_state.dart';

abstract interface class Live2DController {
  Stream<FaceTrackingState> get faceTrackingStates;
  Stream<OrientationState> get orientationStates;

  Future<Live2DCapabilities> initialize();
  Future<void> loadModel(String modelId);
  Future<void> playMotion(String group, {int? index});
  Future<void> setExpression(String expressionId);
  Future<void> setMimicEnabled(bool enabled);
  Future<void> setGyroEnabled(bool enabled);
  Future<void> lookAt(double x, double y);
  Future<void> setParameters(Live2DParameterState state);
  Future<void> calibrate();
  Future<void> setActive(bool active);
  Future<void> dispose();
}
