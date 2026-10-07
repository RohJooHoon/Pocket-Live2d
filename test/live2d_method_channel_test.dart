import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pocket_live2d/live2d/live2d_method_channel.dart';
import 'package:pocket_live2d/live2d/models/live2d_parameter_state.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const methods = MethodChannel('test/live2d');
  const events = EventChannel('test/orientation');
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  tearDown(() {
    messenger.setMockMethodCallHandler(methods, null);
    messenger.setMockMethodCallHandler(const MethodChannel('test/orientation'), null);
  });

  test('initialize and parameter map keep the native wire contract', () async {
    final calls = <MethodCall>[];
    messenger.setMockMethodCallHandler(methods, (call) async {
      calls.add(call);
      return call.method == 'initialize' ? {'nativeSurface': true, 'gyro': true, 'renderer': false} : null;
    });
    final bridge = Live2DMethodChannel(methodChannel: methods);
    final capabilities = await bridge.initialize();
    expect(capabilities.gyro, isTrue);
    expect(capabilities.renderer, isFalse);
    await bridge.setParameters(const Live2DParameterState(angleX: 12));
    expect(calls.last.method, 'setParameters');
    expect((calls.last.arguments as Map)['ParamAngleX'], 12.0);
  });

  test('cancelling the last orientation listener cancels native stream', () async {
    final calls = <String>[];
    messenger.setMockMethodCallHandler(const MethodChannel('test/orientation'), (call) async {
      calls.add(call.method);
      return null;
    });
    final bridge = Live2DMethodChannel(orientationChannel: events);
    final subscription = bridge.orientationStates.listen((_) {});
    await Future<void>.delayed(Duration.zero);
    await subscription.cancel();
    expect(calls, ['listen', 'cancel']);
  });
}
