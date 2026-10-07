import CoreMotion
import Flutter

final class OrientationSource: NSObject, FlutterStreamHandler {
    private let motion = CMMotionManager()
    private var sink: FlutterEventSink?
    private var neutral: [Double]?
    var enabled = false
    var active = false
    var available: Bool { motion.isDeviceMotionAvailable }

    func calibrate() { neutral = nil }

    func update() {
        let shouldRun = enabled && active && sink != nil && available
        if shouldRun == motion.isDeviceMotionActive { return }
        if !shouldRun {
            motion.stopDeviceMotionUpdates()
            return
        }
        calibrate()
        motion.deviceMotionUpdateInterval = 1.0 / 30.0
        motion.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: .main) { [weak self] data, error in
            guard let self = self, self.enabled, self.active, self.sink != nil else { return }
            if let error = error {
                self.sink?(FlutterError(code: "sensor_unavailable", message: error.localizedDescription, details: nil))
                return
            }
            guard let q = data?.attitude.quaternion else { return }
            if let state = self.normalize([q.w, q.x, q.y, q.z]) { self.sink?(state) }
        }
    }

    private func normalize(_ input: [Double]) -> [String: Double]? {
        guard input.allSatisfy({ $0.isFinite }) else { return nil }
        let length = sqrt(input.reduce(0) { $0 + $1 * $1 })
        guard length > 1e-9 else { return nil }
        let q = input.map { $0 / length }
        if neutral == nil { neutral = q }
        guard let base = neutral else { return nil }
        let a = [base[0], -base[1], -base[2], -base[3]]
        var r = [
            a[0]*q[0] - a[1]*q[1] - a[2]*q[2] - a[3]*q[3],
            a[0]*q[1] + a[1]*q[0] + a[2]*q[3] - a[3]*q[2],
            a[0]*q[2] - a[1]*q[3] + a[2]*q[0] + a[3]*q[1],
            a[0]*q[3] + a[1]*q[2] - a[2]*q[1] + a[3]*q[0]
        ]
        if r[0] < 0 { r = r.map { -$0 } }
        let sine = sqrt(r[1]*r[1] + r[2]*r[2] + r[3]*r[3])
        let gain = sine < 1e-9 ? 0 : 2 * acos(max(-1, min(1, r[0]))) / sine / (.pi / 4)
        return ["x": max(-1, min(1, r[2] * gain)),
                "y": max(-1, min(1, r[1] * gain)),
                "z": max(-1, min(1, r[3] * gain))]
    }

    func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
        sink = events
        update()
        return nil
    }
    func onCancel(withArguments arguments: Any?) -> FlutterError? {
        sink = nil
        update()
        return nil
    }
    func dispose() {
        enabled = false
        update()
        sink = nil
    }
}
