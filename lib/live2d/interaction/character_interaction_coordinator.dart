import '../live2d_controller.dart';
import 'character_input_mode.dart';

class CharacterInteractionCoordinator {
  CharacterInteractionCoordinator(this.controller);

  final Live2DController controller;
  CharacterInputMode _mode = CharacterInputMode.idle;
  Future<void> _pending = Future<void>.value();

  CharacterInputMode get mode => _mode;

  Future<void> setMode(CharacterInputMode nextMode) {
    final operation = _pending.then((_) => _transition(nextMode));
    _pending = operation.then<void>((_) {}, onError: (Object _, StackTrace __) {});
    return operation;
  }

  Future<void> stop() {
    // Cancel an outstanding permission/startup request before waiting for it.
    final cancellation = controller.setMimicEnabled(false).then<(Object, StackTrace)?>(
      (_) => null,
      onError: (Object error, StackTrace stack) => (error, stack),
    );
    final operation = _pending.then((_) async {
      final failure = await cancellation;
      if (failure != null) Error.throwWithStackTrace(failure.$1, failure.$2);
      await _applyMode(CharacterInputMode.idle);
      _mode = CharacterInputMode.idle;
    });
    _pending = operation.then<void>((_) {}, onError: (Object _, StackTrace __) {});
    return operation;
  }

  Future<void> _transition(CharacterInputMode nextMode) async {
    if (nextMode == _mode) return;
    final previousMode = _mode;
    try {
      await _applyMode(nextMode);
      _mode = nextMode;
    } catch (_) {
      try {
        await _applyMode(previousMode);
        _mode = previousMode;
      } catch (_) {
        _mode = CharacterInputMode.idle;
        try {
          await _applyMode(CharacterInputMode.idle);
        } catch (_) {
          // The original error is preserved; the UI receives runtime errors too.
        }
      }
      rethrow;
    }
  }

  Future<void> _applyMode(CharacterInputMode mode) async {
    switch (mode) {
      case CharacterInputMode.idle:
        await controller.setMimicEnabled(false);
        await controller.setGyroEnabled(false);
      case CharacterInputMode.gyro:
        await controller.setMimicEnabled(false);
        await controller.setGyroEnabled(true);
      case CharacterInputMode.mimic:
        await controller.setGyroEnabled(false);
        await controller.setMimicEnabled(true);
    }
  }
}
