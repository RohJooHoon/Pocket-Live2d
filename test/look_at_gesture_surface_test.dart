import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motionmate/live2d/interaction/look_at_gesture_surface.dart';
import 'package:motionmate/live2d/live2d_controller.dart';
import 'package:motionmate/live2d/models/face_tracking_state.dart';
import 'package:motionmate/live2d/models/orientation_state.dart';

class _FakeLive2DController implements Live2DController {
  final List<Offset> lookAtCalls = [];
  final List<bool> activeCalls = [];
  final List<Offset> tapCalls = [];

  @override
  Stream<FaceTrackingState> get faceTrackingStates =>
      const Stream<FaceTrackingState>.empty();

  @override
  Stream<OrientationState> get orientationStates =>
      const Stream<OrientationState>.empty();

  @override
  Future<void> initialize() async {}

  @override
  Future<void> loadModel(String modelId) async {}

  @override
  Future<void> lookAt(double x, double y, {bool active = true}) async {
    lookAtCalls.add(Offset(x, y));
    activeCalls.add(active);
  }

  @override
  Future<void> tapAt(double x, double y) async { tapCalls.add(Offset(x, y)); }

  @override
  Future<void> setWallpaper({String modelId = 'mark'}) async {}

  @override
  Future<void> playMotion(String group, {int? index}) async {}

  @override
  Future<void> setExpression(String expressionId) async {}

  @override
  Future<void> setGyroEnabled(bool enabled) async {}

  @override
  Future<void> setMimicEnabled(bool enabled) async {}

  @override
  Future<void> dispose() async {}
}

void main() {
  group('LookAtCoordinates.normalize', () {
    const size = Size(200, 100);

    test('maps center to neutral', () {
      expect(
        LookAtCoordinates.normalize(const Offset(100, 50), size),
        Offset.zero,
      );
    });

    test('maps Flutter top-left to Live2D left-up', () {
      expect(
        LookAtCoordinates.normalize(Offset.zero, size),
        const Offset(-1, 1),
      );
    });

    test('maps bottom-right to right-down', () {
      expect(
        LookAtCoordinates.normalize(const Offset(200, 100), size),
        const Offset(1, -1),
      );
    });

    test('clamps positions outside the surface', () {
      expect(
        LookAtCoordinates.normalize(const Offset(400, -50), size),
        const Offset(1, 1),
      );
    });
  });

  testWidgets('drag sends normalized target and resets on end', (tester) async {
    final controller = _FakeLive2DController();

    await tester.pumpWidget(
      MaterialApp(
        home: Center(
          child: SizedBox(
            width: 200,
            height: 100,
            child: LookAtGestureSurface(
              controller: controller,
              minInterval: Duration.zero,
              child: const ColoredBox(color: Colors.transparent),
            ),
          ),
        ),
      ),
    );

    final surface = find.byType(LookAtGestureSurface);
    final topLeft = tester.getTopLeft(surface);

    final gesture = await tester.startGesture(topLeft + const Offset(100, 50));
    await gesture.moveTo(topLeft + const Offset(200, 0));
    await gesture.up();
    await tester.pump();

    expect(controller.lookAtCalls, contains(const Offset(1, 1)));
    expect(controller.lookAtCalls.last, Offset.zero);
    expect(controller.activeCalls.last, isFalse);
    expect(controller.tapCalls, isEmpty);
  });

  testWidgets('disabling touch resets the current target', (tester) async {
    final controller = _FakeLive2DController();
    var enabled = true;
    late StateSetter setState;

    await tester.pumpWidget(
      MaterialApp(
        home: StatefulBuilder(
          builder: (context, stateSetter) {
            setState = stateSetter;
            return Center(
              child: SizedBox(
                width: 200,
                height: 100,
                child: LookAtGestureSurface(
                  controller: controller,
                  enabled: enabled,
                  minInterval: Duration.zero,
                  child: const ColoredBox(color: Colors.transparent),
                ),
              ),
            );
          },
        ),
      ),
    );

    final surface = find.byType(LookAtGestureSurface);
    final topLeft = tester.getTopLeft(surface);
    final gesture = await tester.startGesture(
      topLeft + const Offset(180, 50),
    );
    await tester.pump();

    expect(controller.lookAtCalls.last.dx, closeTo(0.8, 0.0001));
    expect(controller.lookAtCalls.last.dy, 0);

    setState(() => enabled = false);
    await tester.pump();

    expect(controller.lookAtCalls.last, Offset.zero);

    await gesture.cancel();
  });
  testWidgets('short tap dispatches a normalized hit and releases touch', (tester) async {
    final controller = _FakeLive2DController();
    await tester.pumpWidget(MaterialApp(home: Center(child: SizedBox(
      width: 200, height: 100,
      child: LookAtGestureSurface(controller: controller,
        child: const ColoredBox(color: Colors.transparent)),
    ))));
    final origin = tester.getTopLeft(find.byType(LookAtGestureSurface));
    final gesture = await tester.startGesture(origin + const Offset(150, 25));
    await gesture.up();
    await tester.pump();
    expect(controller.tapCalls, [const Offset(.5, .5)]);
    expect(controller.activeCalls, [true, false]);
  });

}
