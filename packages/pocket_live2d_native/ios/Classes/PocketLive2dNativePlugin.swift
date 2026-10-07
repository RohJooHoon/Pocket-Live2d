import Flutter
import UIKit

public final class PocketLive2dNativePlugin: NSObject, FlutterPlugin {
    private static let methodChannelName = "pocket_live2d/live2d"
    private static let faceTrackingChannelName = "pocket_live2d/face_tracking"
    private static let orientationChannelName = "pocket_live2d/orientation"
    private static let viewType = "pocket_live2d/view"

    private let faceTrackingStreamHandler = PocketLive2dStreamHandler()
    private let orientationStreamHandler = PocketLive2dStreamHandler()

    public static func register(with registrar: FlutterPluginRegistrar) {
        let instance = PocketLive2dNativePlugin()

        let methodChannel = FlutterMethodChannel(
            name: methodChannelName,
            binaryMessenger: registrar.messenger()
        )
        registrar.addMethodCallDelegate(instance, channel: methodChannel)

        let faceTrackingChannel = FlutterEventChannel(
            name: faceTrackingChannelName,
            binaryMessenger: registrar.messenger()
        )
        faceTrackingChannel.setStreamHandler(instance.faceTrackingStreamHandler)

        let orientationChannel = FlutterEventChannel(
            name: orientationChannelName,
            binaryMessenger: registrar.messenger()
        )
        orientationChannel.setStreamHandler(instance.orientationStreamHandler)

        registrar.register(
            PocketLive2dViewFactory(),
            withId: viewType
        )
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "initialize":
            result(nil)
        case "loadModel":
            handleLoadModel(call, result: result)
        case "playMotion":
            handlePlayMotion(call, result: result)
        case "setExpression":
            handleSetExpression(call, result: result)
        case "setGyroEnabled":
            handleSetGyroEnabled(call, result: result)
        case "setMimicEnabled":
            handleSetMimicEnabled(call, result: result)
        case "lookAt":
            handleLookAt(call, result: result)
        case "dispose":
            faceTrackingStreamHandler.clear()
            orientationStreamHandler.clear()
            result(nil)
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    private func handleLoadModel(_ call: FlutterMethodCall, result: FlutterResult) {
        guard
            let args = call.arguments as? [String: Any],
            let modelId = args["modelId"] as? String,
            !modelId.isEmpty
        else {
            result(invalidArgument("modelId is required"))
            return
        }

        // TODO: Route to the Cubism model repository once the SDK is linked.
        result(nil)
    }

    private func handlePlayMotion(_ call: FlutterMethodCall, result: FlutterResult) {
        guard
            let args = call.arguments as? [String: Any],
            let group = args["group"] as? String,
            !group.isEmpty
        else {
            result(invalidArgument("group is required"))
            return
        }

        // TODO: Route group/index to the Cubism motion controller.
        result(nil)
    }

    private func handleSetExpression(_ call: FlutterMethodCall, result: FlutterResult) {
        guard
            let args = call.arguments as? [String: Any],
            let expressionId = args["expressionId"] as? String,
            !expressionId.isEmpty
        else {
            result(invalidArgument("expressionId is required"))
            return
        }

        // TODO: Route to Cubism expression handling.
        result(nil)
    }

    private func handleSetGyroEnabled(_ call: FlutterMethodCall, result: FlutterResult) {
        guard
            let args = call.arguments as? [String: Any],
            let enabled = args["enabled"] as? Bool
        else {
            result(invalidArgument("enabled is required"))
            return
        }

        _ = enabled
        // TODO: Start/stop Core Motion orientation updates.
        result(nil)
    }

    private func handleSetMimicEnabled(_ call: FlutterMethodCall, result: FlutterResult) {
        guard
            let args = call.arguments as? [String: Any],
            let enabled = args["enabled"] as? Bool
        else {
            result(invalidArgument("enabled is required"))
            return
        }

        _ = enabled
        // TODO: Start/stop front-camera face tracking in app mode only.
        result(nil)
    }

    private func handleLookAt(_ call: FlutterMethodCall, result: FlutterResult) {
        guard
            let args = call.arguments as? [String: Any],
            let x = number(args["x"]),
            let y = number(args["y"])
        else {
            result(invalidArgument("x and y are required"))
            return
        }

        _ = x
        _ = y
        // TODO: Route normalized coordinates to eye/head target parameters.
        result(nil)
    }

    private func invalidArgument(_ message: String) -> FlutterError {
        FlutterError(
            code: "invalid_argument",
            message: message,
            details: nil
        )
    }

    private func number(_ value: Any?) -> Double? {
        (value as? NSNumber)?.doubleValue
    }
}
