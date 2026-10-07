import CoreMotion
import Foundation

final class PocketLive2dShakeController {
    private let manager = CMMotionManager()
    private var gravity = (x: 0.0, y: 0.0, z: 0.0)
    private var lastShake = 0.0
    private let onShake: () -> Void
    init(onShake: @escaping () -> Void) { self.onShake = onShake }
    func start() {
        guard manager.isAccelerometerAvailable else { return }
        stop()
        manager.accelerometerUpdateInterval = 1.0 / 60.0
        manager.startAccelerometerUpdates(to: .main) { [weak self] data, _ in
            guard let self, let data else { return }
            let a = data.acceleration
            self.gravity.x = self.gravity.x * 0.8 + a.x * 0.2
            self.gravity.y = self.gravity.y * 0.8 + a.y * 0.2
            self.gravity.z = self.gravity.z * 0.8 + a.z * 0.2
            let x = a.x - self.gravity.x, y = a.y - self.gravity.y, z = a.z - self.gravity.z
            if sqrt(x*x+y*y+z*z) > 1.22 && data.timestamp-self.lastShake > 0.9 {
                self.lastShake = data.timestamp
                self.onShake()
            }
        }
    }
    func stop() {
        manager.stopAccelerometerUpdates()
        gravity = (0,0,0); lastShake = 0
    }
}
