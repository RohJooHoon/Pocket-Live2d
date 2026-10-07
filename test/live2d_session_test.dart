import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:pocket_live2d/live2d/live2d_session.dart';

import 'support/fake_live2d_controller.dart';

void main() {
  testWidgets('failed native gyro command leaves switch state disabled', (tester) async {
    final native = FakeLive2DController()..failGyro = true;
    final session = Live2DSession(native);
    await session.initialize();
    await session.setGyroEnabled(true);
    expect(session.gyroEnabled, isFalse);
    expect(session.status, contains('sensor_unavailable'));
    await session.close();
    session.dispose();
    await tester.pump();
    expect(native.disposed, isTrue);
  });

  testWidgets('parameter calls are coalesced and stop in the background', (tester) async {
    final native = FakeLive2DController()..parameterGate = Completer<void>();
    final session = Live2DSession(native);
    await session.initialize();
    session.lookAt(1, 1);
    await tester.pump(const Duration(milliseconds: 34));
    await tester.pump(const Duration(milliseconds: 200));
    expect(native.parameterCalls, 1);
    expect(native.maxConcurrentCalls, 1);
    expect(native.sentParameters.single.eyeBallX, greaterThan(0));
    await session.setActive(false);
    native.parameterGate!.complete();
    await tester.pump(const Duration(milliseconds: 200));
    expect(native.parameterCalls, 1);
    expect(native.activeCalls.last, isFalse);
    await session.setActive(true);
    await tester.pump(const Duration(milliseconds: 34));
    expect(native.parameterCalls, 2);
    await session.close();
    session.dispose();
    await tester.pump();
    expect(native.orientation.hasListener, isFalse);
    expect(native.disposed, isTrue);
  });

  testWidgets('dispose waits for pending parameters before native cleanup', (tester) async {
    final native = FakeLive2DController()..parameterGate = Completer<void>();
    final session = Live2DSession(native);
    await session.initialize();
    await tester.pump(const Duration(milliseconds: 34));
    final cleanup = session.close();
    session.dispose();
    await tester.pump();
    expect(native.disposed, isFalse);
    native.parameterGate!.complete();
    await cleanup;
    await tester.pump();
    expect(native.disposed, isTrue);
    await tester.pump(const Duration(milliseconds: 100));
    expect(native.parameterCalls, 1);
  });
}
