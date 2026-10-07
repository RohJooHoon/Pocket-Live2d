/// Marker API for the native MotionMate plugin.
///
/// The app-facing MethodChannel and PlatformView contracts currently live in
/// the root application so both layers can evolve independently while the
/// native renderer is being integrated.
abstract final class PocketLive2DNative {
  static const methodChannel = 'pocket_live2d/live2d';
  static const faceTrackingEventChannel = 'pocket_live2d/face_tracking';
  static const orientationEventChannel = 'pocket_live2d/orientation';
  static const viewType = 'pocket_live2d/view';
}
