double nativeValue(Map<Object?, Object?> map, String key) {
  final value = map[key];
  return value is num && value.isFinite ? value.toDouble() : 0;
}
