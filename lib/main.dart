import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'live2d/live2d_controller.dart';
import 'live2d/live2d_method_channel.dart';
import 'live2d/live2d_session.dart';
import 'live2d/live2d_view.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(const PocketLive2DApp());
}

class PocketLive2DApp extends StatelessWidget {
  const PocketLive2DApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Pocket Live2D',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff4e7b67)),
          useMaterial3: true,
        ),
        home: const CharacterHomePage(),
      );
}

class CharacterHomePage extends StatefulWidget {
  const CharacterHomePage({super.key, this.controller, this.surfaceBuilder});

  final Live2DController? controller;
  final WidgetBuilder? surfaceBuilder;

  @override
  State<CharacterHomePage> createState() => _CharacterHomePageState();
}

class _CharacterHomePageState extends State<CharacterHomePage>
    with WidgetsBindingObserver {
  late final Live2DSession _session;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _session = Live2DSession(widget.controller ?? Live2DMethodChannel());
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    if (lifecycle != null && lifecycle != AppLifecycleState.resumed) {
      unawaited(_session.setActive(false));
    }
    unawaited(_session.initialize());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    unawaited(_session.setActive(state == AppLifecycleState.resumed));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _session.dispose();
    super.dispose();
  }

  void _lookAt(Offset position, Size size) {
    if (size.width <= 0 || size.height <= 0) return;
    _session.lookAt(
        position.dx / size.width * 2 - 1, 1 - position.dy / size.height * 2);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: _session,
        builder: (context, _) => Scaffold(
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
                      child: _session.ready &&
                              _session.capabilities.nativeSurface
                          ? LayoutBuilder(builder: (context, constraints) {
                              final size = constraints.biggest;
                              return Listener(
                                behavior: HitTestBehavior.opaque,
                                onPointerDown: (event) =>
                                    _lookAt(event.localPosition, size),
                                onPointerMove: (event) =>
                                    _lookAt(event.localPosition, size),
                                onPointerUp: (_) => _session.endTouch(),
                                onPointerCancel: (_) => _session.endTouch(),
                                child: IgnorePointer(
                                  child: widget.surfaceBuilder?.call(context) ??
                                      const Live2DView(),
                                ),
                              );
                            })
                          : const Center(
                              child: Icon(Icons.face_retouching_natural,
                                  size: 72)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(_session.status, textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  if (!_session.ready)
                    FilledButton(
                      onPressed: _session.busy ? null : _session.initialize,
                      child: const Text('다시 연결'),
                    ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('기울기 반응'),
                    subtitle: const Text('기기를 기울이거나 화면을 드래그해 보세요.'),
                    value: _session.gyroEnabled,
                    onChanged: _session.ready &&
                            !_session.busy &&
                            _session.capabilities.gyro
                        ? _session.setGyroEnabled
                        : null,
                  ),
                  OutlinedButton(
                    onPressed:
                        _session.ready && !_session.busy && _session.gyroEnabled
                            ? _session.calibrate
                            : null,
                    child: const Text('현재 자세를 기준으로 맞추기'),
                  ),
                  const SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('따라하기'),
                    subtitle: Text('얼굴 추적 기능을 준비하고 있습니다.'),
                    value: false,
                    onChanged: null,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}
