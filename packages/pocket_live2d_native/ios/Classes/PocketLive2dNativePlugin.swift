import Flutter
import UIKit

public final class PocketLive2dNativePlugin: NSObject, FlutterPlugin {
    private let orientation = PocketLive2dOrientationController()
    private let factory = PocketLive2dViewFactory()
    private var initialized = false
    private var appActive = true
    private var observers: [NSObjectProtocol] = []
    private var channels: [FlutterEventChannel] = []
    private var methodChannel: FlutterMethodChannel?

    public static func register(with registrar: FlutterPluginRegistrar) {
        let instance = PocketLive2dNativePlugin()
        let methods = FlutterMethodChannel(name: "pocket_live2d/live2d", binaryMessenger: registrar.messenger())
        instance.methodChannel = methods
        registrar.addMethodCallDelegate(instance, channel: methods)
        registrar.register(instance.factory, withId: "pocket_live2d/view")
        let events = FlutterEventChannel(name: "pocket_live2d/orientation", binaryMessenger: registrar.messenger())
        events.setStreamHandler(instance.orientation)
        let face = FlutterEventChannel(name: "pocket_live2d/face_tracking", binaryMessenger: registrar.messenger())
        face.setStreamHandler(EmptyFaceStream())
        instance.channels = [events, face]
        for name in [UIApplication.willResignActiveNotification, UIApplication.didBecomeActiveNotification] {
            instance.observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak instance] notification in
                instance?.updateActivity(foreground: notification.name == UIApplication.didBecomeActiveNotification)
            })
        }
    }

    private func updateActivity(foreground: Bool? = nil) {
        let visible = foreground ?? (UIApplication.shared.applicationState == .active)
        orientation.active = initialized && appActive && visible
        orientation.update()
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        if call.method == "initialize" {
            initialized = true
            updateActivity()
            result(["nativeSurface": true, "gyro": orientation.available, "renderer": false, "mimic": false, "wallpaper": false])
            return
        }
        if call.method == "dispose" {
            initialized = false
            orientation.dispose()
            factory.update([:])
            result(nil)
            return
        }
        guard initialized else {
            result(FlutterError(code: "not_initialized", message: "Call initialize first", details: nil))
            return
        }
        let args = call.arguments as? [String: Any] ?? [:]
        switch call.method {
        case "setGyroEnabled":
            guard let enabled = args["enabled"] as? Bool else { return invalid(result) }
            if enabled && !orientation.available {
                result(FlutterError(code: "sensor_unavailable", message: "Device motion unavailable", details: nil))
                return
            }
            orientation.enabled = enabled
            updateActivity()
            result(nil)
        case "setActive":
            guard let active = args["active"] as? Bool else { return invalid(result) }
            appActive = active
            updateActivity()
            result(nil)
        case "calibrate":
            orientation.calibrate()
            result(nil)
        case "setParameters":
            guard let values = call.arguments as? [String: Double], values.values.allSatisfy({ $0.isFinite }) else { return invalid(result) }
            if appActive { factory.update(values) }
            result(nil)
        case "lookAt":
            guard let x = args["x"] as? Double, let y = args["y"] as? Double, x.isFinite, y.isFinite else { return invalid(result) }
            var values = factory.parameters
            values["ParamEyeBallX"] = max(-1, min(1, x))
            values["ParamEyeBallY"] = max(-1, min(1, y))
            if appActive { factory.update(values) }
            result(nil)
        case "setMimicEnabled":
            if args["enabled"] as? Bool == false { result(nil) }
            else { result(FlutterError(code: "mimic_unavailable", message: "Face tracking adapter is not installed", details: nil)) }
        case "loadModel", "playMotion", "setExpression":
            result(FlutterError(code: "renderer_unavailable", message: "Install the Cubism renderer and model assets first", details: nil))
        case "setWallpaper":
            result(FlutterError(code: "wallpaper_unavailable", message: "Wallpaper is unavailable", details: nil))
        default: result(FlutterMethodNotImplemented)
        }
    }

    private func invalid(_ result: FlutterResult) {
        result(FlutterError(code: "invalid_arguments", message: "Valid arguments are required", details: nil))
    }

    public func detachFromEngine(for registrar: FlutterPluginRegistrar) {
        orientation.dispose()
        channels.forEach { $0.setStreamHandler(nil) }
        methodChannel?.setMethodCallHandler(nil)
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers.removeAll()
    }
    deinit {
        orientation.dispose()
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }
}

private final class EmptyFaceStream: NSObject, FlutterStreamHandler {
    func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? { nil }
    func onCancel(withArguments arguments: Any?) -> FlutterError? { nil }
}
