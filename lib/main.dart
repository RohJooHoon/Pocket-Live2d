import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'live2d/interaction/character_input_mode.dart';
import 'live2d/interaction/character_interaction_coordinator.dart';
import 'live2d/live2d_method_channel.dart';
import 'live2d/live2d_view.dart';

void main() {
  runApp(const PocketLive2DApp());
}

class PocketLive2DApp extends StatelessWidget {
  const PocketLive2DApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Pocket Live2D',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      home: const CharacterHomePage(),
    );
  }
}

class CharacterHomePage extends StatefulWidget {
  const CharacterHomePage({super.key});

  @override
  State<CharacterHomePage> createState() => _CharacterHomePageState();
}

class _CharacterHomePageState extends State<CharacterHomePage> {
  final _controller = Live2DMethodChannel();
  late final CharacterInteractionCoordinator _interactionCoordinator;

  CharacterInputMode _inputMode = CharacterInputMode.idle;
  String _nativeStatus = 'Native Live2D bridge not initialized';

  @override
  void initState() {
    super.initState();
    _interactionCoordinator = CharacterInteractionCoordinator(_controller);
  }

  Future<void> _runNativeAction(Future<void> Function() action) async {
    try {
      await action();
      if (!mounted) return;
      setState(() => _nativeStatus = 'Native bridge connected');
    } on MissingPluginException {
      if (!mounted) return;
      setState(() {
        _nativeStatus = 'Native bridge pending — Sprint 1 implementation';
      });
    } on PlatformException catch (error) {
      if (!mounted) return;
      setState(() => _nativeStatus = 'Native error: ${error.code}');
    }
  }

  Future<void> _setInputMode(CharacterInputMode mode) async {
    setState(() => _inputMode = mode);
    await _runNativeAction(() => _interactionCoordinator.setMode(mode));
  }

  @override
  void dispose() {
    _controller.dispose().catchError((_) {});
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pocket Live2D')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      const Live2DView(),
                      Align(
                        alignment: Alignment.topCenter,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHighest
                                  .withValues(alpha: 0.88),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              child: Text(
                                _nativeStatus,
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => _runNativeAction(_controller.initialize),
                child: const Text('Initialize Live2D'),
              ),
              const SizedBox(height: 16),
              Text(
                'Interaction mode',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              SegmentedButton<CharacterInputMode>(
                segments: const [
                  ButtonSegment(
                    value: CharacterInputMode.idle,
                    icon: Icon(Icons.self_improvement),
                    label: Text('기본'),
                  ),
                  ButtonSegment(
                    value: CharacterInputMode.gyro,
                    icon: Icon(Icons.screen_rotation),
                    label: Text('자이로'),
                  ),
                  ButtonSegment(
                    value: CharacterInputMode.mimic,
                    icon: Icon(Icons.face),
                    label: Text('따라하기'),
                  ),
                ],
                selected: {_inputMode},
                onSelectionChanged: (selection) {
                  if (selection.isEmpty) return;
                  _setInputMode(selection.first);
                },
              ),
              const SizedBox(height: 8),
              Text(
                switch (_inputMode) {
                  CharacterInputMode.idle =>
                    'Idle Motion과 터치 상호작용만 사용합니다.',
                  CharacterInputMode.gyro =>
                    '기울기에 따라 눈·머리·몸이 반응합니다.',
                  CharacterInputMode.mimic =>
                    '전면 카메라로 얼굴 움직임을 추적합니다.',
                },
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
