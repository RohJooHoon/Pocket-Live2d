import Flutter
import UIKit

final class PocketLive2dPlatformView: NSObject, FlutterPlatformView {
    private let rootView: UIView
    private let creationParams: [String: Any]
    private let renderer: PocketLive2dCubismRenderer

    init(
        frame: CGRect,
        viewIdentifier viewId: Int64,
        arguments args: Any?,
        renderer: PocketLive2dCubismRenderer
    ) {
        creationParams = args as? [String: Any] ?? [:]
        self.renderer = renderer
        rootView = renderer.view
        rootView.frame = frame
        super.init()

        rootView.backgroundColor = Self.resolveBackgroundColor(
            creationParams["backgroundColor"]
        )

        if let modelId {
            renderer.loadModel(modelId: modelId)
        }
    }

    var modelId: String? {
        creationParams["modelId"] as? String
    }

    func view() -> UIView {
        rootView
    }

    private static func resolveBackgroundColor(_ rawColor: Any?) -> UIColor {
        guard let number = rawColor as? NSNumber else {
            return .clear
        }

        let argb = UInt32(truncating: number)
        let a = CGFloat((argb >> 24) & 0xFF) / 255.0
        let r = CGFloat((argb >> 16) & 0xFF) / 255.0
        let g = CGFloat((argb >> 8) & 0xFF) / 255.0
        let b = CGFloat(argb & 0xFF) / 255.0

        return UIColor(red: r, green: g, blue: b, alpha: a)
    }

    deinit { renderer.setPaused(true) }
}

final class PocketLive2dViewFactory: NSObject, FlutterPlatformViewFactory {
    private let renderer: PocketLive2dCubismRenderer

    init(renderer: PocketLive2dCubismRenderer) {
        self.renderer = renderer
        super.init()
    }

    func createArgsCodec() -> FlutterMessageCodec & NSObjectProtocol {
        FlutterStandardMessageCodec.sharedInstance()
    }

    func create(
        withFrame frame: CGRect,
        viewIdentifier viewId: Int64,
        arguments args: Any?
    ) -> FlutterPlatformView {
        PocketLive2dPlatformView(
            frame: frame,
            viewIdentifier: viewId,
            arguments: args,
            renderer: renderer
        )
    }
}
