import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pocket_live2d/main.dart';

import 'support/fake_live2d_controller.dart';

void main() {
  testWidgets('surface appears and failed gyro enable stays off', (tester) async {
    final native = FakeLive2DController()..failGyro = true;
    await tester.pumpWidget(MaterialApp(
      home: CharacterHomePage(
        controller: native,
        surfaceBuilder: (_) => const ColoredBox(color: Colors.green, key: Key('surface')),
      ),
    ));
    await tester.pump();
    expect(find.byKey(const Key('surface')), findsOneWidget);
    final switches = tester.widgetList<SwitchListTile>(find.byType(SwitchListTile));
    expect(switches.last.onChanged, isNull);
    await tester.tap(find.text('기울기 반응'));
    await tester.pump();
    expect(tester.widgetList<SwitchListTile>(find.byType(SwitchListTile)).first.value, isFalse);
    expect(find.textContaining('sensor_unavailable'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await native.disposalStarted.future;
    expect(native.disposed, isTrue);
  });
}
