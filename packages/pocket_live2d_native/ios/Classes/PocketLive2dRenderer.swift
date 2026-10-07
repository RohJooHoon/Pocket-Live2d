import Foundation

protocol PocketLive2dRenderer: AnyObject {
    func initialize()
    func loadModel(modelId: String)
    func playMotion(group: String, index: Int?)
    func setExpression(expressionId: String)
    func lookAt(x: Double, y: Double)
    func applyOrientation(x: Double, y: Double, z: Double)
    func applyParameters(_ parameters: [String: Double])
    func dispose()
}
