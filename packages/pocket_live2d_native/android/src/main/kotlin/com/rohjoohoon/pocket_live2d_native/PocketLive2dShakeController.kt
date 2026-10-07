package com.rohjoohoon.pocket_live2d_native

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.sqrt

internal class PocketLive2dShakeController(context: Context, private val onShake: () -> Unit) : SensorEventListener {
    private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val sensor = manager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
    private var lastShake = 0L
    fun start() { sensor?.let { manager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) } }
    fun stop() { manager.unregisterListener(this); lastShake = 0 }
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    override fun onSensorChanged(event: SensorEvent) {
        val v = event.values
        val magnitude = sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2])
        if (magnitude > 12f && event.timestamp-lastShake > 900_000_000L) {
            lastShake = event.timestamp
            onShake()
        }
    }
}
