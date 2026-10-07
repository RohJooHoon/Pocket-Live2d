import Foundation

protocol PocketLive2dRenderer: AnyObject {
    func initialize()
    func loadModel(modelId: String)
    func playMotion(group: String, index: Int?)
    func setExpression(expressionId: String)
    func lookAt(x: Double, y: Double)
    func applyOrientation(x: Double, y: Double, z: Double)
    func applyFaceTracking(_ state: [String: Double])
    func dispose()
}

/// Temporary implementation used until the Cubism SDK/Core is linked locally.
final class PendingCubismRenderer: PocketLive2dRenderer {
    func initialize() {}
    func loadModel(modelId: String) {}
    func playMotion(group: String, index: Int?) {}
    func setExpression(expressionId: String) {}
    func lookAt(x: Double, y: Double) {}
    func applyOrientation(x: Double, y: Double, z: Double) {}
    func applyFaceTracking(_ state: [String: Double]) {}
    func dispose() {}
}
