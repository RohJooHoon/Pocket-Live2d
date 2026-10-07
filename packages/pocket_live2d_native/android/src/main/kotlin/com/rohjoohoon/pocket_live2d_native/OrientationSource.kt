package com.rohjoohoon.pocket_live2d_native

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import io.flutter.plugin.common.EventChannel

internal class OrientationSource(context: Context) : EventChannel.StreamHandler, SensorEventListener {
    private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val sensor = manager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
        ?: manager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    private val normalizer = OrientationNormalizer()
    private var sink: EventChannel.EventSink? = null
    private var running = false
    var enabled = false
    var active = false
    val available get() = sensor != null

    fun update() {
        val shouldRun = enabled && active && sink != null && available
        if (shouldRun == running) return
        if (shouldRun) {
            normalizer.calibrate()
            running = manager.registerListener(this, sensor, 33333)
            if (!running) sink?.error("sensor_unavailable", "Could not start rotation sensor", null)
        } else {
            manager.unregisterListener(this)
            running = false
        }
    }

    fun calibrate() = normalizer.calibrate()
    fun dispose() {
        enabled = false
        update()
        sink = null
    }

    override fun onListen(arguments: Any?, events: EventChannel.EventSink) {
        sink = events
        update()
    }
    override fun onCancel(arguments: Any?) {
        sink = null
        update()
    }
    override fun onSensorChanged(event: SensorEvent) {
        if (!running) return
        val q = FloatArray(4)
        SensorManager.getQuaternionFromVector(q, event.values)
        normalizer.normalize(DoubleArray(4) { q[it].toDouble() })?.let { sink?.success(it) }
    }
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
