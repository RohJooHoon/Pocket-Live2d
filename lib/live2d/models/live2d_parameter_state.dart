class Live2DParameterState {
  const Live2DParameterState({
    this.angleX = 0,
    this.angleY = 0,
    this.angleZ = 0,
    this.eyeBallX = 0,
    this.eyeBallY = 0,
    this.eyeLOpen = 1,
    this.eyeROpen = 1,
    this.mouthOpenY = 0,
    this.mouthForm = 0,
    this.bodyAngleX = 0,
  });

  final double angleX;
  final double angleY;
  final double angleZ;
  final double eyeBallX;
  final double eyeBallY;
  final double eyeLOpen;
  final double eyeROpen;
  final double mouthOpenY;
  final double mouthForm;
  final double bodyAngleX;

  Map<String, double> toMap() => {
        'ParamAngleX': angleX,
        'ParamAngleY': angleY,
        'ParamAngleZ': angleZ,
        'ParamEyeBallX': eyeBallX,
        'ParamEyeBallY': eyeBallY,
        'ParamEyeLOpen': eyeLOpen,
        'ParamEyeROpen': eyeROpen,
        'ParamMouthOpenY': mouthOpenY,
        'ParamMouthForm': mouthForm,
        'ParamBodyAngleX': bodyAngleX,
      };
}
