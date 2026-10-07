import '../models/orientation_state.dart';

class OrientationFilterConfig {
  const OrientationFilterConfig({
    this.deadZone = 0.03,
    this.smoothingFactor = 0.1,
  });

  final double deadZone;
  final double smoothingFactor;
}

class OrientationFilter {
  OrientationFilter({
    this.config = const OrientationFilterConfig(),
  })  : assert(config.deadZone >= 0 && config.deadZone < 1),
        assert(config.smoothingFactor > 0 && config.smoothingFactor <= 1);

  final OrientationFilterConfig config;

  OrientationState _current = const OrientationState();

  OrientationState get current => _current;

  OrientationState update(OrientationState target) {
    final filteredTarget = OrientationState(
      x: _applyDeadZone(_clampUnit(target.x)),
      y: _applyDeadZone(_clampUnit(target.y)),
      z: _applyDeadZone(_clampUnit(target.z)),
    );

    _current = OrientationState(
      x: _lerp(_current.x, filteredTarget.x),
      y: _lerp(_current.y, filteredTarget.y),
      z: _lerp(_current.z, filteredTarget.z),
    );

    return _current;
  }

  void reset() {
    _current = const OrientationState();
  }

  double _applyDeadZone(double value) {
    if (value.abs() <= config.deadZone) return 0;

    final sign = value.isNegative ? -1.0 : 1.0;
    final adjusted = (value.abs() - config.deadZone) / (1 - config.deadZone);
    return adjusted * sign;
  }

  double _lerp(double current, double target) {
    return current + (target - current) * config.smoothingFactor;
  }

  double _clampUnit(double value) {
    if (!value.isFinite) return 0;
    if (value < -1) return -1;
    if (value > 1) return 1;
    return value;
  }
}
