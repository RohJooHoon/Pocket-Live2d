import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pocket_live2d/live2d/live2d_method_channel.dart';
import 'package:pocket_live2d_native/pocket_live2d_native.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const methodChannel = MethodChannel(PocketLive2DNative.methodChannel);
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  late List<MethodCall> calls;
  late Live2DMethodChannel controller;

  setUp(() {
    calls = [];
    messenger.setMockMethodCallHandler(methodChannel, (call) async {
      calls.add(call);
      return null;
    });

    controller = Live2DMethodChannel(methodChannel: methodChannel);
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(methodChannel, null);
  });

  test('serializes core native bridge commands', () async {
    await controller.initialize();
    await controller.loadModel('haru');
    await controller.playMotion('TapBody', index: 2);
    await controller.setExpression('happy');
    await controller.setGyroEnabled(true);
    await controller.setMimicEnabled(false);
    await controller.lookAt(0.5, -0.25);
    await controller.dispose();

    expect(
      calls.map((call) => call.method),
      [
        'initialize',
        'loadModel',
        'playMotion',
        'setExpression',
        'setGyroEnabled',
        'setMimicEnabled',
        'lookAt',
        'dispose',
      ],
    );

    expect(calls[1].arguments, {'modelId': 'haru'});
    expect(calls[2].arguments, {'group': 'TapBody', 'index': 2});
    expect(calls[3].arguments, {'expressionId': 'happy'});
    expect(calls[4].arguments, {'enabled': true});
    expect(calls[5].arguments, {'enabled': false});
    expect(calls[6].arguments, {'x': 0.5, 'y': -0.25});
  });

  test('omits optional motion index when not provided', () async {
    await controller.playMotion('Idle');

    expect(calls.single.method, 'playMotion');
    expect(calls.single.arguments, {'group': 'Idle'});
  });
  test('serializes touch release, hit test and wallpaper request', () async {
    await controller.lookAt(0, 0, active: false);
    await controller.tapAt(.5, -.25);
    await controller.setWallpaper();
    expect(calls.map((call) => call.method), ['lookAt', 'tapAt', 'setWallpaper']);
    expect(calls[0].arguments, {'x': 0.0, 'y': 0.0, 'active': false});
    expect(calls[1].arguments, {'x': .5, 'y': -.25});
    expect(calls[2].arguments, {'modelId': 'mark'});
  });

}
