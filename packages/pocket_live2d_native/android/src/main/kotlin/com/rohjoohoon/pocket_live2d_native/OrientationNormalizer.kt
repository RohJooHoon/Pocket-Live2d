package com.rohjoohoon.pocket_live2d_native

import kotlin.math.acos
import kotlin.math.sqrt

/** Quaternion order is w,x,y,z. Relative axis-angle avoids Euler wrap jumps. */
internal class OrientationNormalizer {
    private var neutral: DoubleArray? = null

    fun calibrate() { neutral = null }

    fun normalize(input: DoubleArray): Map<String, Double>? {
        if (input.size != 4 || input.any { !it.isFinite() }) return null
        val length = sqrt(input.sumOf { it * it })
        if (length < 1e-9) return null
        val q = input.map { it / length }.toDoubleArray()
        val base = neutral ?: q.copyOf().also { neutral = it }
        val a = doubleArrayOf(base[0], -base[1], -base[2], -base[3])
        val r = doubleArrayOf(
            a[0]*q[0] - a[1]*q[1] - a[2]*q[2] - a[3]*q[3],
            a[0]*q[1] + a[1]*q[0] + a[2]*q[3] - a[3]*q[2],
            a[0]*q[2] - a[1]*q[3] + a[2]*q[0] + a[3]*q[1],
            a[0]*q[3] + a[1]*q[2] - a[2]*q[1] + a[3]*q[0],
        )
        if (r[0] < 0) for (i in r.indices) r[i] = -r[i]
        val sine = sqrt(r[1]*r[1] + r[2]*r[2] + r[3]*r[3])
        val gain = if (sine < 1e-9) 0.0 else 2 * acos(r[0].coerceIn(-1.0, 1.0)) / sine / (Math.PI / 4)
        return mapOf(
            "x" to (r[2] * gain).coerceIn(-1.0, 1.0),
            "y" to (r[1] * gain).coerceIn(-1.0, 1.0),
            "z" to (r[3] * gain).coerceIn(-1.0, 1.0),
        )
    }
}
