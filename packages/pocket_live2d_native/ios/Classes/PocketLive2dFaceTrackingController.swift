import ARKit
import Foundation

final class PocketLive2dFaceTrackingController: NSObject, ARSessionDelegate {
    typealias State = [String: Double]

    private let session = ARSession()
    private let onState: (State) -> Void
    private let onError: (String, String) -> Void

    private var lastEmitTimestamp = 0.0
    private var isRunning = false

    init(
        onState: @escaping (State) -> Void,
        onError: @escaping (String, String) -> Void
    ) {
        self.onState = onState
        self.onError = onError
        super.init()
        session.delegate = self
    }

    var isSupported: Bool {
        ARFaceTrackingConfiguration.isSupported
    }

    @discardableResult
    func start() -> Bool {
        guard isSupported else {
            return false
        }

        let configuration = ARFaceTrackingConfiguration()
        configuration.isLightEstimationEnabled = false
        configuration.maximumNumberOfTrackedFaces = 1

        session.run(
            configuration,
            options: [.resetTracking, .removeExistingAnchors]
        )
        isRunning = true
        lastEmitTimestamp = 0
        return true
    }

    func stop() {
        guard isRunning else { return }
        session.pause()
        isRunning = false
        lastEmitTimestamp = 0
    }

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        guard isRunning else { return }
        guard let faceAnchor = anchors.compactMap({ $0 as? ARFaceAnchor }).first else {
            return
        }

        let timestamp = session.currentFrame?.timestamp ?? ProcessInfo.processInfo.systemUptime
        guard timestamp - lastEmitTimestamp >= Self.eventIntervalSeconds else {
            return
        }
        lastEmitTimestamp = timestamp

        let state = makeState(from: faceAnchor)
        DispatchQueue.main.async { [weak self] in
            self?.onState(state)
        }
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        DispatchQueue.main.async { [weak self] in
            self?.onError("face_tracking_failed", error.localizedDescription)
        }
    }

    private func makeState(from anchor: ARFaceAnchor) -> State {
        let head = eulerDegrees(from: anchor.transform)

        let blinkLeft = blend(anchor, .eyeBlinkLeft)
        let blinkRight = blend(anchor, .eyeBlinkRight)

        let lookRight = average(
            blend(anchor, .eyeLookInLeft),
            blend(anchor, .eyeLookOutRight)
        )
        let lookLeft = average(
            blend(anchor, .eyeLookOutLeft),
            blend(anchor, .eyeLookInRight)
        )
        let lookUp = average(
            blend(anchor, .eyeLookUpLeft),
            blend(anchor, .eyeLookUpRight)
        )
        let lookDown = average(
            blend(anchor, .eyeLookDownLeft),
            blend(anchor, .eyeLookDownRight)
        )

        let smile = average(
            blend(anchor, .mouthSmileLeft),
            blend(anchor, .mouthSmileRight)
        )
        let frown = average(
            blend(anchor, .mouthFrownLeft),
            blend(anchor, .mouthFrownRight)
        )

        let browLeft = max(
            blend(anchor, .browOuterUpLeft),
            blend(anchor, .browInnerUp)
        )
        let browRight = max(
            blend(anchor, .browOuterUpRight),
            blend(anchor, .browInnerUp)
        )

        return [
            "headYaw": head.yaw,
            "headPitch": head.pitch,
            "headRoll": head.roll,
            "eyeBlinkLeft": clamp01(blinkLeft),
            "eyeBlinkRight": clamp01(blinkRight),
            "eyeLookX": clampUnit(lookRight - lookLeft),
            "eyeLookY": clampUnit(lookUp - lookDown),
            "mouthOpen": clamp01(blend(anchor, .jawOpen)),
            "mouthForm": clampUnit(smile - frown),
            "browLeft": clamp01(browLeft),
            "browRight": clamp01(browRight),
            "trackingConfidence": 1.0,
        ]
    }

    private func blend(
        _ anchor: ARFaceAnchor,
        _ location: ARFaceAnchor.BlendShapeLocation
    ) -> Double {
        anchor.blendShapes[location]?.doubleValue ?? 0
    }

    private func eulerDegrees(
        from transform: simd_float4x4
    ) -> (yaw: Double, pitch: Double, roll: Double) {
        let r00 = Double(transform.columns.0.x)
        let r10 = Double(transform.columns.0.y)
        let r20 = Double(transform.columns.0.z)
        let r21 = Double(transform.columns.1.z)
        let r22 = Double(transform.columns.2.z)

        let horizontal = sqrt((r00 * r00) + (r10 * r10))
        let pitch = atan2(-r20, horizontal)
        let yaw = atan2(r10, r00)
        let roll = atan2(r21, r22)

        return (
            yaw: radiansToDegrees(yaw),
            pitch: radiansToDegrees(pitch),
            roll: radiansToDegrees(roll)
        )
    }

    private func radiansToDegrees(_ radians: Double) -> Double {
        radians * 180.0 / .pi
    }

    private func average(_ lhs: Double, _ rhs: Double) -> Double {
        (lhs + rhs) / 2.0
    }

    private func clamp01(_ value: Double) -> Double {
        min(max(value, 0), 1)
    }

    private func clampUnit(_ value: Double) -> Double {
        min(max(value, -1), 1)
    }

    private static let eventIntervalSeconds = 1.0 / 30.0
}
