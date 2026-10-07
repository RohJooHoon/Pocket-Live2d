import 'package:flutter_test/flutter_test.dart';
import 'package:pocket_live2d/live2d/models/orientation_state.dart';
import 'package:pocket_live2d/live2d/tracking/orientation_filter.dart';

void main() {
  group('OrientationFilter', () {
    test('removes small movement inside dead zone', () {
      final filter = OrientationFilter(
        config: const OrientationFilterConfig(
          deadZone: 0.05,
          smoothingFactor: 1,
        ),
      );

      final state = filter.update(
        const OrientationState(x: 0.03, y: -0.04, z: 0.05),
      );

      expect(state.x, 0);
      expect(state.y, 0);
      expect(state.z, 0);
    });

    test('smooths large movement over multiple frames', () {
      final filter = OrientationFilter(
        config: const OrientationFilterConfig(
          deadZone: 0,
          smoothingFactor: 0.1,
        ),
      );

      final first = filter.update(const OrientationState(x: 1));
      final second = filter.update(const OrientationState(x: 1));

      expect(first.x, closeTo(0.1, 0.0001));
      expect(second.x, closeTo(0.19, 0.0001));
    });

    test('clamps input and can reset to center', () {
      final filter = OrientationFilter(
        config: const OrientationFilterConfig(
          deadZone: 0,
          smoothingFactor: 1,
        ),
      );

      final state = filter.update(
        const OrientationState(x: 3, y: -2, z: 9),
      );

      expect(state.x, 1);
      expect(state.y, -1);
      expect(state.z, 1);

      filter.reset();
      expect(filter.current.x, 0);
      expect(filter.current.y, 0);
      expect(filter.current.z, 0);
    });
  });
}
