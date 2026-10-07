import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'live2d_controller.dart';
import 'interaction/character_input_mode.dart';
import 'interaction/character_interaction_coordinator.dart';
import 'models/live2d_capabilities.dart';
import 'models/live2d_parameter_state.dart';
import 'models/orientation_state.dart';
import 'tracking/live2d_parameter_smoother.dart';
import 'tracking/live2d_tracking_mapper.dart';
import 'tracking/orientation_filter.dart';

/// Owns input subscriptions, foreground state and a bounded parameter pump.
class Live2DSession extends ChangeNotifier {
  Live2DSession(this.controller) : _coordinator = CharacterInteractionCoordinator(controller);

  final Live2DController controller;
  final CharacterInteractionCoordinator _coordinator;
  final _filter = OrientationFilter(config: const OrientationFilterConfig(deadZone: 0.04, smoothingFactor: 1));
  final _mapper = const Live2DTrackingMapper();
  final _smoother = Live2DParameterSmoother();
  final _clock = Stopwatch();
  StreamSubscription<OrientationState>? _orientationSubscription;
  Timer? _timer;
  Future<void> _commands = Future<void>.value();
  Future<void>? _pump;
  Future<void>? _cleanup;
  Live2DParameterState? _pending;
  OrientationState _orientation = const OrientationState();
  Live2DParameterState? _touch;
  Duration _lastFrame = Duration.zero;
  bool _closed = false;
  bool _active = true;
  bool _ready = false;
  bool _busy = false;
  bool _gyroEnabled = false;
  Live2DCapabilities _capabilities = const Live2DCapabilities();
  String _status = '입력 테스트를 준비하고 있습니다.';

  bool get ready => _ready;
  bool get busy => _busy;
  bool get gyroEnabled => _gyroEnabled;
  Live2DCapabilities get capabilities => _capabilities;
  String get status => _status;

  Future<void> initialize() => _run(() async {
        if (_ready) return;
        final capabilities = await controller.initialize();
        if (_closed) return;
        await controller.setActive(_active);
        if (_closed) return;
        _capabilities = capabilities;
        _ready = true;
        _orientationSubscription ??= controller.orientationStates.listen(
          (state) {
            if (_active && _gyroEnabled) _orientation = state;
          },
          onError: (Object error) {
            if (_closed) return;
            unawaited(_run(() async {
              _gyroEnabled = false;
              _orientation = const OrientationState();
              await controller.setGyroEnabled(false);
              _status = '기울기 입력을 중지했습니다.';
            }));
          },
        );
        _status = capabilities.renderer
            ? '캐릭터가 준비되었습니다.'
            : '센서·터치 테스트가 준비되었습니다. 캐릭터 모델은 준비 중입니다.';
        _startFrames();
      });

  Future<void> setGyroEnabled(bool enabled) => _run(() async {
        if (!_ready) return;
        // UI state changes only after the native command succeeds.
        await _coordinator.setMode(enabled ? CharacterInputMode.gyro : CharacterInputMode.idle);
        _gyroEnabled = enabled;
        _orientation = const OrientationState();
        _smoother.reset();
    _filter.reset();
        _status = enabled ? '지금 자세를 기준으로 기울여 보세요.' : '기울기 입력을 껐습니다.';
      });

  Future<void> calibrate() => _run(() async {
        if (!_ready) return;
        await controller.calibrate();
        _orientation = const OrientationState();
        _smoother.reset();
    _filter.reset();
        _status = '현재 자세를 기준으로 맞췄습니다.';
      });

  void lookAt(double x, double y) {
    if (!_ready || !_active || !x.isFinite || !y.isFinite) return;
    final nx = x.clamp(-1.0, 1.0).toDouble();
    final ny = y.clamp(-1.0, 1.0).toDouble();
    _touch = Live2DParameterState(
      angleX: nx * 30,
      angleY: ny * 30,
      eyeBallX: nx,
      eyeBallY: ny,
      bodyAngleX: nx * 10,
    );
  }

  void endTouch() => _touch = null;

  Future<void> setActive(bool active) {
    _active = active;
    _touch = null;
    _orientation = const OrientationState();
    _smoother.reset();
    _filter.reset();
    _stopFrames();
    return _run(() async {
      if (!_ready) return;
      await controller.setActive(_active);
      if (_active) _startFrames();
    });
  }

  Future<void> _run(Future<void> Function() action) {
    final next = _commands.then((_) async {
      if (_closed) return;
      _busy = true;
      notifyListeners();
      try {
        await action();
      } on MissingPluginException {
        _status = '이 환경에서는 기기 입력을 사용할 수 없습니다.';
      } on PlatformException catch (error) {
        _status = '입력을 처리하지 못했습니다: ${error.code}';
      } catch (error) {
        _status = '입력을 처리하지 못했습니다.';
      } finally {
        _busy = false;
        if (!_closed) notifyListeners();
      }
    });
    _commands = next;
    return next;
  }

  void _startFrames() {
    if (!_active || !_ready || _closed || _timer != null) return;
    _clock.start();
    _lastFrame = _clock.elapsed;
    _timer = Timer.periodic(const Duration(milliseconds: 33), (_) {
      final now = _clock.elapsed;
      final target = _touch ?? _mapper.fromOrientation(_filter.update(_orientation));
      _pending = _smoother.step(target, now - _lastFrame);
      _lastFrame = now;
      _pump ??= _flush().whenComplete(() => _pump = null);
    });
  }

  Future<void> _flush() async {
    while (!_closed && _active && _ready && _pending != null) {
      final state = _pending!;
      _pending = null;
      try {
        await controller.setParameters(state);
      } catch (error) {
        _stopFrames();
        if (!_closed) {
          _status = '화면 입력을 처리하지 못했습니다.';
          notifyListeners();
        }
        return;
      }
    }
  }

  void _stopFrames() {
    _timer?.cancel();
    _timer = null;
    _clock.stop();
    _pending = null;
  }

  Future<void> close() {
    if (_cleanup != null) return _cleanup!;
    _closed = true;
    _stopFrames();
    return _cleanup = _commands.then((_) async {
      await _pump;
      await _orientationSubscription?.cancel();
      await controller.dispose();
    });
  }

  @override
  void dispose() {
    unawaited(close().catchError((Object _) {}));
    super.dispose();
  }
}
