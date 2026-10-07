import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pocket_live2d_native/pocket_live2d_native.dart';

class Live2DView extends StatelessWidget {
  const Live2DView({
    super.key,
    this.modelId,
    this.backgroundColor,
  });

  final String? modelId;
  final Color? backgroundColor;

  Map<String, Object?> get _creationParams => {
        if (modelId != null) 'modelId': modelId,
        if (backgroundColor != null)
          'backgroundColor': backgroundColor!.toARGB32(),
      };

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return const Center(child: Text('iPhone 또는 Android에서 실행해 주세요.'));
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return AndroidView(
          viewType: PocketLive2DNative.viewType,
          creationParams: _creationParams,
          creationParamsCodec: const StandardMessageCodec(),
        );
      case TargetPlatform.iOS:
        return UiKitView(
          viewType: PocketLive2DNative.viewType,
          creationParams: _creationParams,
          creationParamsCodec: const StandardMessageCodec(),
        );
      case TargetPlatform.fuchsia:
      case TargetPlatform.linux:
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
        return const Center(
          child: Text('Live2D native view supports iOS and Android only.'),
        );
    }
  }
}
