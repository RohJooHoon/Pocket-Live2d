import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class Live2DSurface extends StatelessWidget {
  const Live2DSurface({super.key});

  static const viewType = 'pocket_live2d/surface';

  @override
  Widget build(BuildContext context) {
    if (!kIsWeb) {
      switch (defaultTargetPlatform) {
        case TargetPlatform.android:
          return const AndroidView(
            viewType: viewType,
            layoutDirection: TextDirection.ltr,
            creationParamsCodec: StandardMessageCodec(),
          );
        case TargetPlatform.iOS:
          return const UiKitView(
            viewType: viewType,
            layoutDirection: TextDirection.ltr,
            creationParamsCodec: StandardMessageCodec(),
          );
        default:
          break;
      }
    }
    return const Center(child: Text('iPhone 또는 Android에서 실행해 주세요.'));
  }
}
