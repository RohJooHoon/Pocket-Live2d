/// Capabilities describe implemented features, not just channel availability.
class Live2DCapabilities {
  const Live2DCapabilities({
    this.nativeSurface = false,
    this.gyro = false,
    this.renderer = false,
    this.mimic = false,
    this.wallpaper = false,
  });

  final bool nativeSurface;
  final bool gyro;
  final bool renderer;
  final bool mimic;
  final bool wallpaper;

  factory Live2DCapabilities.fromMap(Map<Object?, Object?> map) =>
      Live2DCapabilities(
        nativeSurface: map['nativeSurface'] == true,
        gyro: map['gyro'] == true,
        renderer: map['renderer'] == true,
        mimic: map['mimic'] == true,
        wallpaper: map['wallpaper'] == true,
      );
}
