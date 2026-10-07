import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'live2d/live2d_method_channel.dart';

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

  bool _gyroEnabled = false;
  bool _mimicEnabled = false;
  String _nativeStatus = 'Native Live2D bridge not initialized';

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
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.face_retouching_natural, size: 72),
                        const SizedBox(height: 16),
                        const Text('Live2D native surface'),
                        const SizedBox(height: 8),
                        Text(
                          _nativeStatus,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => _runNativeAction(_controller.initialize),
                child: const Text('Initialize Live2D'),
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Gyro mode'),
                subtitle: const Text('기울기에 따라 눈·머리·몸이 반응합니다.'),
                value: _gyroEnabled,
                onChanged: (value) {
                  setState(() => _gyroEnabled = value);
                  _runNativeAction(() => _controller.setGyroEnabled(value));
                },
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('따라하기'),
                subtitle: const Text('전면 카메라로 얼굴 움직임을 추적합니다.'),
                value: _mimicEnabled,
                onChanged: (value) {
                  setState(() => _mimicEnabled = value);
                  _runNativeAction(() => _controller.setMimicEnabled(value));
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
