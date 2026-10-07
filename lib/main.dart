import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'live2d/interaction/character_input_mode.dart';
import 'live2d/interaction/character_interaction_coordinator.dart';
import 'live2d/interaction/look_at_gesture_surface.dart';
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
  bool _modeChangeInFlight = false;

  @override
  void initState() {
    super.initState();
    _interactionCoordinator = CharacterInteractionCoordinator(_controller);
  }

  Future<bool> _runNativeAction(Future<void> Function() action) async {
    try {
      await action();
      if (!mounted) return false;
      setState(() => _nativeStatus = 'Native bridge connected');
      return true;
    } on MissingPluginException {
      if (!mounted) return false;
      setState(() {
        _nativeStatus = 'Native bridge pending — Sprint 1 implementation';
      });
      return false;
    } on PlatformException catch (error) {
      if (!mounted) return false;
      setState(() => _nativeStatus = 'Native error: ${error.code}');
      return false;
    } catch (error) {
      if (!mounted) return false;
      setState(() => _nativeStatus = 'Interaction error: $error');
      return false;
    }
  }

  Future<void> _setInputMode(CharacterInputMode mode) async {
    if (_modeChangeInFlight || mode == _inputMode) return;

    setState(() {
      _modeChangeInFlight = true;
      _nativeStatus = 'Switching interaction mode…';
    });

    final succeeded = await _runNativeAction(
      () => _interactionCoordinator.setMode(mode),
    );

    if (!mounted) return;
    setState(() {
      if (succeeded) {
        _inputMode = mode;
      }
      _modeChangeInFlight = false;
    });
  }

  @override
  void dispose() {
    _controller.dispose().catchError((_) {});
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final touchLookAtEnabled = _inputMode != CharacterInputMode.mimic;

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
                      LookAtGestureSurface(
                        controller: _controller,
                        enabled: touchLookAtEnabled,
                        child: const Live2DView(),
                      ),
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
                onSelectionChanged: _modeChangeInFlight
                    ? null
                    : (selection) {
                        if (selection.isEmpty) return;
                        _setInputMode(selection.first);
                      },
              ),
              const SizedBox(height: 8),
              Text(
                switch (_inputMode) {
                  CharacterInputMode.idle =>
                    '화면을 터치하거나 드래그하면 캐릭터가 시선을 따라갑니다.',
                  CharacterInputMode.gyro =>
                    '기울기에 반응하며 터치·드래그로 시선을 움직일 수 있습니다.',
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
