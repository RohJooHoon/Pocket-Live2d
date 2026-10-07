package com.rohjoohoon.pocket_live2d_native

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.PI
import kotlin.math.abs

internal class PocketLive2dOrientationController(
    context: Context,
    private val onOrientation: (Map<String, Any>) -> Unit,
) : SensorEventListener {
    private val sensorManager =
        context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val rotationVectorSensor =
        sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

    private val rotationMatrix = FloatArray(9)
    private val orientation = FloatArray(3)

    private var baselineAzimuth: Float? = null
    private var baselinePitch: Float? = null
    private var baselineRoll: Float? = null

    private var filteredX = 0.0
    private var filteredY = 0.0
    private var filteredZ = 0.0
    private var lastEmitTimestampNs = 0L

    val isSupported: Boolean
        get() = rotationVectorSensor != null

    fun start(): Boolean {
        val sensor = rotationVectorSensor ?: return false
        resetCalibration()
        return sensorManager.registerListener(
            this,
            sensor,
            SensorManager.SENSOR_DELAY_GAME,
        )
    }

    fun stop() {
        sensorManager.unregisterListener(this)
        resetCalibration()
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return

        SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
        SensorManager.getOrientation(rotationMatrix, orientation)

        val azimuth = orientation[0]
        val pitch = orientation[1]
        val roll = orientation[2]

        if (baselineAzimuth == null) {
            baselineAzimuth = azimuth
            baselinePitch = pitch
            baselineRoll = roll
            return
        }

        val rawX = normalizeAngleDelta(
            roll - requireNotNull(baselineRoll),
            MAX_TILT_RADIANS,
        )
        val rawY = normalizeAngleDelta(
            -(pitch - requireNotNull(baselinePitch)),
            MAX_TILT_RADIANS,
        )
        val rawZ = normalizeAngleDelta(
            wrapRadians(azimuth - requireNotNull(baselineAzimuth)),
            MAX_TWIST_RADIANS,
        )

        filteredX = smooth(filteredX, applyDeadZone(rawX))
        filteredY = smooth(filteredY, applyDeadZone(rawY))
        filteredZ = smooth(filteredZ, applyDeadZone(rawZ))

        if (event.timestamp - lastEmitTimestampNs < EVENT_INTERVAL_NS) return
        lastEmitTimestampNs = event.timestamp

        onOrientation(
            mapOf(
                "x" to filteredX,
                "y" to filteredY,
                "z" to filteredZ,
            ),
        )
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun resetCalibration() {
        baselineAzimuth = null
        baselinePitch = null
        baselineRoll = null
        filteredX = 0.0
        filteredY = 0.0
        filteredZ = 0.0
        lastEmitTimestampNs = 0L
    }

    private fun normalizeAngleDelta(delta: Float, maxRadians: Double): Double {
        return (delta.toDouble() / maxRadians).coerceIn(-1.0, 1.0)
    }

    private fun applyDeadZone(value: Double): Double {
        if (abs(value) <= DEAD_ZONE) return 0.0

        val sign = if (value < 0) -1.0 else 1.0
        return ((abs(value) - DEAD_ZONE) / (1.0 - DEAD_ZONE)) * sign
    }

    private fun smooth(current: Double, target: Double): Double {
        return current + (target - current) * SMOOTHING_FACTOR
    }

    private fun wrapRadians(value: Float): Float {
        var wrapped = value
        while (wrapped > PI) wrapped -= (2.0 * PI).toFloat()
        while (wrapped < -PI) wrapped += (2.0 * PI).toFloat()
        return wrapped
    }

    companion object {
        private const val DEAD_ZONE = 0.03
        private const val SMOOTHING_FACTOR = 0.10
        private const val EVENT_INTERVAL_NS = 33_000_000L
        private val MAX_TILT_RADIANS = Math.toRadians(30.0)
        private val MAX_TWIST_RADIANS = Math.toRadians(20.0)
    }
}
