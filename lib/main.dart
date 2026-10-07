import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'live2d/interaction/character_input_mode.dart';
import 'live2d/interaction/character_interaction_coordinator.dart';
import 'live2d/interaction/look_at_gesture_surface.dart';
import 'live2d/live2d_method_channel.dart';
import 'live2d/live2d_view.dart';

void main() => runApp(const PocketLive2DApp());

class PocketLive2DApp extends StatelessWidget {
  const PocketLive2DApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Pocket Live2D',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff71a888)),
          useMaterial3: true,
        ),
        home: const CharacterHomePage(),
      );
}

class CharacterHomePage extends StatefulWidget {
  const CharacterHomePage({super.key});
  @override
  State<CharacterHomePage> createState() => _CharacterHomePageState();
}

class _CharacterHomePageState extends State<CharacterHomePage>
    with WidgetsBindingObserver {
  final _controller = Live2DMethodChannel();
  late final CharacterInteractionCoordinator _coordinator;
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  CharacterInputMode _inputMode = CharacterInputMode.idle;
  CharacterInputMode _requestedMode = CharacterInputMode.idle;
  CharacterInputMode _resumeMode = CharacterInputMode.idle;
  Future<void> _suspension = Future<void>.value();
  String _status = '캐릭터를 준비하고 있어요.';
  bool _changing = false;
  bool _foreground = true;
  bool _modelReady = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _coordinator = CharacterInteractionCoordinator(_controller);
    _subscriptions.add(_controller.rendererStates.listen(_rendererState,
        onError: _runtimeError));
    _subscriptions.add(_controller.faceTrackingStates.listen((_) {},
        onError: _runtimeError));
    _subscriptions.add(_controller.orientationStates.listen((_) {},
        onError: _runtimeError));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_initialize());
    });
  }

  Future<void> _initialize() async {
    if (await _action(_controller.initialize)) {
      await _action(() => _controller.loadModel('mark'));
    }
  }

  void _rendererState(Map<Object?, Object?> event) {
    if (!mounted) return;
    final state = event['state'];
    setState(() {
      _modelReady = state == 'loaded';
      _status = switch (state) {
        'loaded' => 'Mark-kun 준비 완료',
        'loading' => '캐릭터를 불러오고 있어요.',
        'sdk_unavailable' => 'Live2D SDK 연결이 필요합니다.',
        'error' => '캐릭터 오류: ${event['message']}',
        _ => _status,
      };
    });
  }

  void _runtimeError(Object error) {
    if (!mounted) return;
    _requestedMode = CharacterInputMode.idle;
    _resumeMode = CharacterInputMode.idle;
    setState(() => _status = '입력이 중단됐어요: $error');
    unawaited(_coordinator.stop().catchError((_) {}).whenComplete(() {
      if (mounted) setState(() => _inputMode = _coordinator.mode);
    }));
  }

  Future<bool> _action(Future<void> Function() operation) async {
    try {
      await operation();
      return mounted;
    } on PlatformException catch (error) {
      if (mounted) {
        setState(() => _status = error.code == 'sdk_unavailable'
            ? 'Live2D SDK 연결이 필요합니다.'
            : '작업 실패: ${error.message ?? error.code}');
      }
    } on MissingPluginException {
      if (mounted) setState(() => _status = 'iOS 또는 Android 앱에서 실행해 주세요.');
    } catch (error) {
      if (mounted) setState(() => _status = '작업 실패: $error');
    }
    return false;
  }

  Future<void> _setMode(CharacterInputMode mode) async {
    if (_changing || !_foreground) return;
    _requestedMode = mode;
    setState(() => _changing = true);
    final success = await _action(() => _coordinator.setMode(mode));
    if (!mounted) return;
    setState(() {
      _inputMode = _coordinator.mode;
      _changing = false;
      if (!success) _requestedMode = _inputMode;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached) {
      if (!_foreground) return;
      _foreground = false;
      _resumeMode = _requestedMode;
      _suspension = _coordinator.stop().catchError((_) {}).whenComplete(() {
        if (mounted) setState(() => _inputMode = _coordinator.mode);
      });
      unawaited(_suspension);
    } else if (state == AppLifecycleState.resumed && !_foreground) {
      _foreground = true;
      unawaited(_restoreInputs());
    }
  }

  Future<void> _restoreInputs() async {
    await _suspension;
    if (mounted && _foreground) await _setMode(_resumeMode);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    for (final subscription in _subscriptions) {
      unawaited(subscription.cancel());
    }
    unawaited(_controller.dispose().catchError((_) {}));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Pocket Live2D'),
          actions: [
            IconButton(
              icon: const Icon(Icons.info_outline),
              onPressed: () => showAboutDialog(
                context: context,
                applicationName: 'Pocket Live2D',
                applicationVersion: '0.1.0',
                children: const [
                  Text('This content uses sample data owned and copyrighted by Live2D Inc. '
                      'The sample data are utilized in accordance with terms and conditions set by Live2D Inc. '
                      'This content itself is created at the author’s sole discretion.'),
                ],
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Card(
                    clipBehavior: Clip.antiAlias,
                    child: LookAtGestureSurface(
                      controller: _controller,
                      enabled: _modelReady && !_changing && _foreground &&
                          _inputMode != CharacterInputMode.mimic,
                      child: const Live2DView(modelId: 'mark'),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(_status, textAlign: TextAlign.center),
                const SizedBox(height: 12),
                SegmentedButton<CharacterInputMode>(
                  segments: const [
                    ButtonSegment(value: CharacterInputMode.idle,
                        icon: Icon(Icons.self_improvement), label: Text('기본')),
                    ButtonSegment(value: CharacterInputMode.gyro,
                        icon: Icon(Icons.screen_rotation), label: Text('자이로')),
                    ButtonSegment(value: CharacterInputMode.mimic,
                        icon: Icon(Icons.face), label: Text('따라하기')),
                  ],
                  selected: {_inputMode},
                  onSelectionChanged: _changing || !_foreground ? null :
                      (selection) { if (selection.isNotEmpty) unawaited(_setMode(selection.first)); },
                ),
                const SizedBox(height: 8),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  children: [
                    FilledButton.tonal(
                      onPressed: _modelReady ? () => _action(() =>
                          _controller.playMotion('TapBody')) : null,
                      child: const Text('반응'),
                    ),
                    FilledButton.tonal(
                      onPressed: _modelReady ? () => _action(() =>
                          _controller.setExpression('happy')) : null,
                      child: const Text('표정'),
                    ),
                    if (defaultTargetPlatform == TargetPlatform.android)
                      FilledButton.tonal(
                        onPressed: _modelReady ? () =>
                            _action(_controller.setWallpaper) : null,
                        child: const Text('배경화면'),
                      ),
                    IconButton(
                      onPressed: _initialize,
                      icon: const Icon(Icons.refresh),
                      tooltip: '캐릭터 다시 불러오기',
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
}
