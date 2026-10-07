import 'native_value.dart';

/// Relative portrait rotation: Y axis -> x, X axis -> y, Z axis -> z.
/// Native normalizes each axis by 45 degrees after neutral calibration.
class OrientationState {
  const OrientationState({
    this.x = 0,
    this.y = 0,
    this.z = 0,
  });

  final double x;
  final double y;
  final double z;

  factory OrientationState.fromMap(Map<Object?, Object?> map) {
    double value(String key) => nativeValue(map, key);

    return OrientationState(
      x: value('x'),
      y: value('y'),
      z: value('z'),
    );
  }
}
