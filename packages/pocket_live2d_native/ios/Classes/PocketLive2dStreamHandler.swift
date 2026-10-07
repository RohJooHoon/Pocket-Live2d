import Flutter
import Foundation

final class PocketLive2dStreamHandler: NSObject, FlutterStreamHandler {
    private var eventSink: FlutterEventSink?

    func onListen(
        withArguments arguments: Any?,
        eventSink events: @escaping FlutterEventSink
    ) -> FlutterError? {
        eventSink = events
        return nil
    }

    func onCancel(withArguments arguments: Any?) -> FlutterError? {
        eventSink = nil
        return nil
    }

    func emit(_ event: [String: Any]) {
        eventSink?(event)
    }

    func emitError(code: String, message: String, details: Any? = nil) {
        eventSink?(FlutterError(code: code, message: message, details: details))
    }

    func clear() {
        eventSink = nil
    }
}
