import CoreMotion
import Foundation

final class PocketLive2dOrientationController {
    private let motionManager = CMMotionManager()
    private let onOrientation: ([String: Any]) -> Void

    private var baselineRoll: Double?
    private var baselinePitch: Double?
    private var baselineYaw: Double?

    private var filteredX = 0.0
    private var filteredY = 0.0
    private var filteredZ = 0.0
    private var lastEmitTimestamp = 0.0

    init(onOrientation: @escaping ([String: Any]) -> Void) {
        self.onOrientation = onOrientation
    }

    var isSupported: Bool {
        motionManager.isDeviceMotionAvailable
    }

    @discardableResult
    func start() -> Bool {
        guard motionManager.isDeviceMotionAvailable else {
            return false
        }

        stop()
        resetCalibration()
        motionManager.deviceMotionUpdateInterval = 1.0 / 60.0

        motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, error in
            guard let self, error == nil, let motion else {
                return
            }
            self.handle(motion)
        }

        return motionManager.isDeviceMotionActive
    }

    func stop() {
        if motionManager.isDeviceMotionActive {
            motionManager.stopDeviceMotionUpdates()
        }
        resetCalibration()
    }

    private func handle(_ motion: CMDeviceMotion) {
        let attitude = motion.attitude

        if baselineRoll == nil {
            baselineRoll = attitude.roll
            baselinePitch = attitude.pitch
            baselineYaw = attitude.yaw
            return
        }

        let rawX = normalize(
            attitude.roll - (baselineRoll ?? attitude.roll),
            maxRadians: Self.maxTiltRadians
        )
        let rawY = normalize(
            -(attitude.pitch - (baselinePitch ?? attitude.pitch)),
            maxRadians: Self.maxTiltRadians
        )
        let rawZ = normalize(
            wrapRadians(attitude.yaw - (baselineYaw ?? attitude.yaw)),
            maxRadians: Self.maxTwistRadians
        )

        filteredX = smooth(filteredX, applyDeadZone(rawX))
        filteredY = smooth(filteredY, applyDeadZone(rawY))
        filteredZ = smooth(filteredZ, applyDeadZone(rawZ))

        if motion.timestamp - lastEmitTimestamp < Self.eventIntervalSeconds {
            return
        }
        lastEmitTimestamp = motion.timestamp

        onOrientation([
            "x": filteredX,
            "y": filteredY,
            "z": filteredZ,
        ])
    }

    private func resetCalibration() {
        baselineRoll = nil
        baselinePitch = nil
        baselineYaw = nil
        filteredX = 0
        filteredY = 0
        filteredZ = 0
        lastEmitTimestamp = 0
    }

    private func normalize(_ value: Double, maxRadians: Double) -> Double {
        min(max(value / maxRadians, -1), 1)
    }

    private func applyDeadZone(_ value: Double) -> Double {
        if abs(value) <= Self.deadZone {
            return 0
        }

        let sign = value < 0 ? -1.0 : 1.0
        let adjusted = (abs(value) - Self.deadZone) / (1 - Self.deadZone)
        return adjusted * sign
    }

    private func smooth(_ current: Double, _ target: Double) -> Double {
        current + (target - current) * Self.smoothingFactor
    }

    private func wrapRadians(_ value: Double) -> Double {
        var wrapped = value
        while wrapped > .pi { wrapped -= 2 * .pi }
        while wrapped < -.pi { wrapped += 2 * .pi }
        return wrapped
    }

    private static let deadZone = 0.03
    private static let smoothingFactor = 0.10
    private static let eventIntervalSeconds = 1.0 / 30.0
    private static let maxTiltRadians = 30.0 * .pi / 180.0
    private static let maxTwistRadians = 20.0 * .pi / 180.0
}
