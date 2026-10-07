import Flutter
import UIKit

public final class PocketLive2dNativePlugin: NSObject, FlutterPlugin {
    private static let methodChannelName = "pocket_live2d/live2d"
    private static let faceTrackingChannelName = "pocket_live2d/face_tracking"
    private static let orientationChannelName = "pocket_live2d/orientation"
    private static let viewType = "pocket_live2d/view"

    private let faceTrackingStreamHandler = PocketLive2dStreamHandler()
    private let orientationStreamHandler = PocketLive2dStreamHandler()
    private let statusStreamHandler = PocketLive2dStreamHandler()
    private var renderer: PocketLive2dCubismRenderer!
    private var notifications: [NSObjectProtocol] = []
    private var initialized = false
    private lazy var shakeController = PocketLive2dShakeController { [weak self] in
        self?.renderer.playMotion(group: "Shake", index: nil)
    }

    private lazy var orientationController = PocketLive2dOrientationController {
        [weak self] event in
        guard let self else { return }
        self.renderer.applyOrientation(
            x: self.number(event["x"]) ?? 0,
            y: self.number(event["y"]) ?? 0,
            z: self.number(event["z"]) ?? 0
        )
        self.orientationStreamHandler.emit(event)
    }

    private lazy var faceTrackingController = PocketLive2dFaceTrackingController(
        onState: { [weak self] state in
            guard let self else { return }
            self.renderer.applyFaceTracking(state)
            self.faceTrackingStreamHandler.emit(
                state.mapValues { $0 as Any }
            )
        },
        onError: { [weak self] code, message in
            self?.faceTrackingStreamHandler.emitError(
                code: code,
                message: message
            )
        }
    )

    public static func register(with registrar: FlutterPluginRegistrar) {
        let instance = PocketLive2dNativePlugin()
        instance.renderer = PocketLive2dCubismRenderer(
            resolve: { key in
                let asset = registrar.lookupKey(forAsset: key)
                return Bundle.main.bundlePath + "/" + asset
            },
            status: { [weak instance] event in instance?.statusStreamHandler.emit(event) }
        )
        let status = FlutterEventChannel(name: "pocket_live2d/status", binaryMessenger: registrar.messenger())
        status.setStreamHandler(instance.statusStreamHandler)
        instance.notifications.append(NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main
        ) { [weak instance] _ in
            instance?.orientationController.stop()
            instance?.faceTrackingController.stop()
            instance?.shakeController.stop()
            instance?.renderer.resetInput()
            instance?.renderer.setPaused(true)
        })
        instance.notifications.append(NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main
        ) { [weak instance] _ in
            instance?.renderer.setPaused(false)
            if instance?.initialized == true { instance?.shakeController.start() }
        })

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
            PocketLive2dViewFactory(renderer: instance.renderer),
            withId: viewType
        )
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "initialize":
            do {
                try renderer.initialize()
                initialized = true
                shakeController.start()
                result(nil)
            } catch {
                result(FlutterError(code: "sdk_unavailable", message: error.localizedDescription, details: nil))
            }
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
        case "tapAt":
            guard let args = call.arguments as? [String: Any], let x = number(args["x"]), let y = number(args["y"]) else {
                result(invalidArgument("x and y are required"))
                return
            }
            renderer.tapAt(x: x, y: y)
            result(nil)
        case "setWallpaper":
            result(FlutterError(code: "unsupported_platform", message: "Live Wallpaper is Android-only", details: nil))
        case "dispose":
            orientationController.stop()
            faceTrackingController.stop()
            shakeController.stop()
            initialized = false
            notifications.forEach { NotificationCenter.default.removeObserver($0) }
            notifications.removeAll()
            renderer.dispose()
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

        renderer.loadModel(modelId: modelId)
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

        let index = (args["index"] as? NSNumber)?.intValue
        renderer.playMotion(group: group, index: index)
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

        renderer.setExpression(expressionId: expressionId)
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

        if !enabled {
            orientationController.stop()
            renderer.resetInput()
            result(nil)
            return
        }

        guard UIApplication.shared.applicationState != .background else {
            result(FlutterError(code: "app_in_background", message: "Foreground app required", details: nil))
            return
        }
        faceTrackingController.stop()

        guard orientationController.isSupported else {
            result(
                FlutterError(
                    code: "sensor_unavailable",
                    message: "Device motion is not available on this device",
                    details: nil
                )
            )
            return
        }

        guard orientationController.start() else {
            result(
                FlutterError(
                    code: "sensor_start_failed",
                    message: "Failed to start Core Motion device updates",
                    details: nil
                )
            )
            return
        }

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

        if !enabled {
            faceTrackingController.stop()
            renderer.resetInput()
            result(nil)
            return
        }

        guard UIApplication.shared.applicationState != .background else {
            result(FlutterError(code: "app_in_background", message: "Foreground app required", details: nil))
            return
        }
        orientationController.stop()

        guard faceTrackingController.isSupported else {
            result(
                FlutterError(
                    code: "face_tracking_unavailable",
                    message: "ARKit face tracking is not supported on this device",
                    details: nil
                )
            )
            return
        }

        guard faceTrackingController.start() else {
            result(
                FlutterError(
                    code: "face_tracking_start_failed",
                    message: "Failed to start ARKit face tracking",
                    details: nil
                )
            )
            return
        }

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

        renderer.lookAt(
            x: min(max(x, -1), 1),
            y: min(max(y, -1), 1),
            active: args["active"] as? Bool ?? true
        )
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
