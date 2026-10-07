import 'models/face_tracking_state.dart';
import 'models/orientation_state.dart';

abstract interface class Live2DController {
  Stream<FaceTrackingState> get faceTrackingStates;
  Stream<OrientationState> get orientationStates;

  Future<void> initialize();
  Future<void> loadModel(String modelId);
  Future<void> playMotion(String group, {int? index});
  Future<void> setExpression(String expressionId);
  Future<void> setMimicEnabled(bool enabled);
  Future<void> setGyroEnabled(bool enabled);
  Future<void> lookAt(double x, double y, {bool active = true});
  Future<void> tapAt(double x, double y);
  Future<void> setWallpaper({String modelId = 'mark'});
  Future<void> dispose();
}
