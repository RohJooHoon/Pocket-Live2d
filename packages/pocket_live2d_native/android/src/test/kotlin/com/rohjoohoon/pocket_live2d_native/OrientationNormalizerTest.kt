package com.rohjoohoon.pocket_live2d_native

import org.junit.Assert.*
import org.junit.Test
import kotlin.math.cos
import kotlin.math.sin

class OrientationNormalizerTest {
    private fun yRotation(degrees: Double): DoubleArray {
        val half = degrees * Math.PI / 360
        return doubleArrayOf(cos(half), 0.0, sin(half), 0.0)
    }

    @Test fun neutralAndPositiveTilt() {
        val normalizer = OrientationNormalizer()
        assertEquals(0.0, normalizer.normalize(yRotation(10))!!["x"]!!, 1e-9)
        assertEquals(1.0, normalizer.normalize(yRotation(55))!!["x"]!!, 1e-9)
        normalizer.calibrate()
        assertEquals(0.0, normalizer.normalize(yRotation(55))!!["x"]!!, 1e-9)
    }

    @Test fun quaternionSignAndHeadingWrapDoNotCauseJumps() {
        val normalizer = OrientationNormalizer()
        normalizer.normalize(yRotation(179))
        val result = normalizer.normalize(yRotation(-179))!!
        val same = normalizer.normalize(yRotation(-179).map { -it }.toDoubleArray())!!
        assertEquals(2.0/45.0, result["x"]!!, 1e-9)
        assertEquals(result["x"]!!, same["x"]!!, 1e-9)
    }

    @Test fun invalidSamplesAreRejected() {
        val normalizer = OrientationNormalizer()
        assertNull(normalizer.normalize(doubleArrayOf(Double.NaN, 0.0, 0.0, 0.0)))
        assertNull(normalizer.normalize(doubleArrayOf(0.0, 0.0, 0.0, 0.0)))
    }
}
