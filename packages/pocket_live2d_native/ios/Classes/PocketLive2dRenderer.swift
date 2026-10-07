import Foundation
import UIKit

protocol PocketLive2dRenderer: AnyObject {
    func initialize() throws
    func loadModel(modelId: String)
    func playMotion(group: String, index: Int?)
    func setExpression(expressionId: String)
    func lookAt(x: Double, y: Double, active: Bool)
    func tapAt(x: Double, y: Double)
    func applyOrientation(x: Double, y: Double, z: Double)
    func applyFaceTracking(_ state: [String: Double])
    func resetInput()
    func setPaused(_ paused: Bool)
    func dispose()
}

final class PocketLive2dCubismRenderer: PocketLive2dRenderer {
    private let surface: PocketCubismSurface
    var view: UIView { surface.view }

    init(resolve: @escaping (String) -> String, status: @escaping ([String: Any]) -> Void) {
        surface = PocketCubismSurface(resolve: resolve, status: { data in
            status(data as? [String: Any] ?? [:])
        })
    }
    func initialize() throws {
        guard PocketCubismSurface.sdkAvailable else {
            throw NSError(domain: "sdk_unavailable", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Install Cubism Native 5-r.5 with tool/prepare_cubism.py"
            ])
        }
    }
    func loadModel(modelId: String) { surface.load(modelId: modelId) }
    func playMotion(group: String, index: Int?) { surface.play(group: group, index: index ?? -1) }
    func setExpression(expressionId: String) { surface.set(expression: expressionId) }
    func lookAt(x: Double, y: Double, active: Bool) { surface.look(x: x, y: y, active: active) }
    func tapAt(x: Double, y: Double) { surface.tap(x: x, y: y) }
    func applyOrientation(x: Double, y: Double, z: Double) { surface.orientation(x: x, y: y, z: z) }
    func applyFaceTracking(_ state: [String: Double]) {
        func v(_ key: String) -> Double { state[key] ?? 0 }
        surface.face([
            v("headYaw"), v("headPitch"), v("headRoll"), v("eyeLookX"), v("eyeLookY"),
            1-v("eyeBlinkLeft"), 1-v("eyeBlinkRight"), v("mouthOpen"), v("mouthForm"),
            0, v("browLeft"), v("browRight")
        ].map { NSNumber(value: $0) })
    }
    func resetInput() { surface.resetInput() }
    func setPaused(_ paused: Bool) { surface.setPaused(paused) }
    func dispose() { surface.dispose() }
}
