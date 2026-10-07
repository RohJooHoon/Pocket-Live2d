import Foundation

/// Low-pass filter shared conceptually with the Android implementation.
/// Fast features such as blinks and mouth movement use a larger alpha than
/// head motion. Lost tracking eases back toward a neutral pose.
final class PocketLive2dFaceTrackingFilter {
    private let confidenceThreshold: Double
    private let lock = NSLock()
    private var previous: [String: Double]?

    init(confidenceThreshold: Double = 0.35) {
        self.confidenceThreshold = confidenceThreshold
    }

    func reset() {
        lock.lock()
        previous = nil
        lock.unlock()
    }

    func apply(_ input: [String: Double]) -> [String: Double] {
        lock.lock()
        defer { lock.unlock() }

        guard let current = previous else {
            let initial = confidence(input) >= confidenceThreshold
                ? normalized(input)
                : neutralState(trackingConfidence: confidence(input))
            previous = initial
            return initial
        }

        let target = confidence(input) >= confidenceThreshold
            ? normalized(input)
            : neutralState(trackingConfidence: confidence(input))

        var output: [String: Double] = [:]
        putSmoothed(&output, current: current, target: target, key: "headYaw", alpha: Self.headAlpha)
        putSmoothed(&output, current: current, target: target, key: "headPitch", alpha: Self.headAlpha)
        putSmoothed(&output, current: current, target: target, key: "headRoll", alpha: Self.headAlpha)

        putSmoothed(&output, current: current, target: target, key: "eyeBlinkLeft", alpha: Self.blinkAlpha)
        putSmoothed(&output, current: current, target: target, key: "eyeBlinkRight", alpha: Self.blinkAlpha)
        putSmoothed(&output, current: current, target: target, key: "eyeLookX", alpha: Self.eyeAlpha)
        putSmoothed(&output, current: current, target: target, key: "eyeLookY", alpha: Self.eyeAlpha)

        putSmoothed(&output, current: current, target: target, key: "mouthOpen", alpha: Self.mouthAlpha)
        putSmoothed(&output, current: current, target: target, key: "mouthForm", alpha: Self.mouthAlpha)

        putSmoothed(&output, current: current, target: target, key: "browLeft", alpha: Self.browAlpha)
        putSmoothed(&output, current: current, target: target, key: "browRight", alpha: Self.browAlpha)

        output["trackingConfidence"] = clamp01(
            lerp(
                from: current["trackingConfidence"] ?? 0,
                to: target["trackingConfidence"] ?? 0,
                alpha: Self.confidenceAlpha
            )
        )

        previous = output
        return output
    }

    private func normalized(_ input: [String: Double]) -> [String: Double] {
        [
            "headYaw": input["headYaw"] ?? 0,
            "headPitch": input["headPitch"] ?? 0,
            "headRoll": input["headRoll"] ?? 0,
            "eyeBlinkLeft": clamp01(input["eyeBlinkLeft"] ?? 0),
            "eyeBlinkRight": clamp01(input["eyeBlinkRight"] ?? 0),
            "eyeLookX": clampUnit(input["eyeLookX"] ?? 0),
            "eyeLookY": clampUnit(input["eyeLookY"] ?? 0),
            "mouthOpen": clamp01(input["mouthOpen"] ?? 0),
            "mouthForm": clampUnit(input["mouthForm"] ?? 0),
            "browLeft": clamp01(input["browLeft"] ?? 0),
            "browRight": clamp01(input["browRight"] ?? 0),
            "trackingConfidence": confidence(input),
        ]
    }

    private func neutralState(trackingConfidence: Double) -> [String: Double] {
        [
            "headYaw": 0,
            "headPitch": 0,
            "headRoll": 0,
            "eyeBlinkLeft": 0,
            "eyeBlinkRight": 0,
            "eyeLookX": 0,
            "eyeLookY": 0,
            "mouthOpen": 0,
            "mouthForm": 0,
            "browLeft": 0,
            "browRight": 0,
            "trackingConfidence": clamp01(trackingConfidence),
        ]
    }

    private func confidence(_ input: [String: Double]) -> Double {
        clamp01(input["trackingConfidence"] ?? 0)
    }

    private func putSmoothed(
        _ destination: inout [String: Double],
        current: [String: Double],
        target: [String: Double],
        key: String,
        alpha: Double
    ) {
        destination[key] = lerp(
            from: current[key] ?? 0,
            to: target[key] ?? 0,
            alpha: alpha
        )
    }

    private func lerp(from: Double, to: Double, alpha: Double) -> Double {
        from + ((to - from) * min(max(alpha, 0), 1))
    }

    private func clamp01(_ value: Double) -> Double {
        min(max(value, 0), 1)
    }

    private func clampUnit(_ value: Double) -> Double {
        min(max(value, -1), 1)
    }

    private static let headAlpha = 0.18
    private static let eyeAlpha = 0.45
    private static let blinkAlpha = 0.68
    private static let mouthAlpha = 0.52
    private static let browAlpha = 0.35
    private static let confidenceAlpha = 0.25
}
