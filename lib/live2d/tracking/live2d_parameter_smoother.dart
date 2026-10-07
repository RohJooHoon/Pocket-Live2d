import 'dart:math' as math;

import '../models/live2d_parameter_state.dart';

/// Response gains match the plan at 60 Hz and stay consistent at other rates.
class Live2DParameterSmoother {
  Live2DParameterState _current = const Live2DParameterState();

  void reset() => _current = const Live2DParameterState();

  Live2DParameterState step(Live2DParameterState target, Duration elapsed) {
    final frames = (elapsed.inMicroseconds / 1000000 * 60).clamp(0, 6);
    double blend(double from, double to, double response) =>
        from + (to - from) * (1 - math.pow(1 - response, frames));

    return _current = Live2DParameterState(
      angleX: blend(_current.angleX, target.angleX, 0.10),
      angleY: blend(_current.angleY, target.angleY, 0.10),
      angleZ: blend(_current.angleZ, target.angleZ, 0.10),
      eyeBallX: blend(_current.eyeBallX, target.eyeBallX, 0.18),
      eyeBallY: blend(_current.eyeBallY, target.eyeBallY, 0.18),
      eyeLOpen: blend(_current.eyeLOpen, target.eyeLOpen, 0.18),
      eyeROpen: blend(_current.eyeROpen, target.eyeROpen, 0.18),
      mouthOpenY: blend(_current.mouthOpenY, target.mouthOpenY, 0.18),
      mouthForm: blend(_current.mouthForm, target.mouthForm, 0.18),
      bodyAngleX: blend(_current.bodyAngleX, target.bodyAngleX, 0.04),
    );
  }
}
