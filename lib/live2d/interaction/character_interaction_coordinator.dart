import '../live2d_controller.dart';
import 'character_input_mode.dart';

class CharacterInteractionCoordinator {
  CharacterInteractionCoordinator(this.controller);

  final Live2DController controller;

  CharacterInputMode _mode = CharacterInputMode.idle;

  CharacterInputMode get mode => _mode;

  Future<void> setMode(CharacterInputMode nextMode) async {
    if (nextMode == _mode) return;

    final previousMode = _mode;

    try {
      await _applyMode(nextMode);
      _mode = nextMode;
    } catch (_) {
      try {
        await _applyMode(previousMode);
      } catch (_) {
        // Preserve the original transition error. The caller can decide how to
        // surface recovery failure while the coordinator keeps its last known
        // logical mode.
      }
      rethrow;
    }
  }

  Future<void> _applyMode(CharacterInputMode mode) async {
    switch (mode) {
      case CharacterInputMode.idle:
        await controller.setMimicEnabled(false);
        await controller.setGyroEnabled(false);
        break;
      case CharacterInputMode.gyro:
        await controller.setMimicEnabled(false);
        await controller.setGyroEnabled(true);
        break;
      case CharacterInputMode.mimic:
        await controller.setGyroEnabled(false);
        await controller.setMimicEnabled(true);
        break;
    }
  }
}
