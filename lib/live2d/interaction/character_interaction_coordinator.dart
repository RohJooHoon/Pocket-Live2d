import '../live2d_controller.dart';
import 'character_input_mode.dart';

class CharacterInteractionCoordinator {
  CharacterInteractionCoordinator(this.controller);

  final Live2DController controller;

  CharacterInputMode _mode = CharacterInputMode.idle;

  CharacterInputMode get mode => _mode;

  Future<void> setMode(CharacterInputMode nextMode) async {
    switch (nextMode) {
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

    _mode = nextMode;
  }
}
