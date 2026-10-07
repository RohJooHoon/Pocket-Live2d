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
    double value(String key) => (map[key] as num?)?.toDouble() ?? 0;

    return OrientationState(
      x: value('x'),
      y: value('y'),
      z: value('z'),
    );
  }
}
