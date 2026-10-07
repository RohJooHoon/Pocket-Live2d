package com.rohjoohoon.pocket_live2d_native

/**
 * Low-pass filter for face tracking values.
 *
 * Fast features such as blinks and mouth movement receive a larger alpha than
 * head motion. When tracking confidence drops, values ease back to neutral
 * instead of snapping immediately.
 */
internal class PocketLive2dFaceTrackingFilter(
    private val confidenceThreshold: Double = 0.35,
) {
    private var previous: Map<String, Double>? = null

    fun reset() {
        previous = null
    }

    fun apply(input: Map<String, Double>): Map<String, Double> {
        val current = previous
        if (current == null) {
            val initial = if (confidence(input) >= confidenceThreshold) {
                normalized(input)
            } else {
                neutralState(trackingConfidence = confidence(input))
            }
            previous = initial
            return initial
        }

        val target = if (confidence(input) >= confidenceThreshold) {
            normalized(input)
        } else {
            neutralState(trackingConfidence = confidence(input))
        }

        val output = buildMap {
            putSmoothed(this, current, target, "headYaw", HEAD_ALPHA)
            putSmoothed(this, current, target, "headPitch", HEAD_ALPHA)
            putSmoothed(this, current, target, "headRoll", HEAD_ALPHA)

            putSmoothed(this, current, target, "eyeBlinkLeft", BLINK_ALPHA)
            putSmoothed(this, current, target, "eyeBlinkRight", BLINK_ALPHA)
            putSmoothed(this, current, target, "eyeLookX", EYE_ALPHA)
            putSmoothed(this, current, target, "eyeLookY", EYE_ALPHA)

            putSmoothed(this, current, target, "mouthOpen", MOUTH_ALPHA)
            putSmoothed(this, current, target, "mouthForm", MOUTH_ALPHA)

            putSmoothed(this, current, target, "browLeft", BROW_ALPHA)
            putSmoothed(this, current, target, "browRight", BROW_ALPHA)

            put(
                "trackingConfidence",
                lerp(
                    current["trackingConfidence"] ?: 0.0,
                    target["trackingConfidence"] ?: 0.0,
                    CONFIDENCE_ALPHA,
                ).coerceIn(0.0, 1.0),
            )
        }

        previous = output
        return output
    }

    private fun normalized(input: Map<String, Double>): Map<String, Double> = mapOf(
        "headYaw" to (input["headYaw"] ?: 0.0),
        "headPitch" to (input["headPitch"] ?: 0.0),
        "headRoll" to (input["headRoll"] ?: 0.0),
        "eyeBlinkLeft" to (input["eyeBlinkLeft"] ?: 0.0).coerceIn(0.0, 1.0),
        "eyeBlinkRight" to (input["eyeBlinkRight"] ?: 0.0).coerceIn(0.0, 1.0),
        "eyeLookX" to (input["eyeLookX"] ?: 0.0).coerceIn(-1.0, 1.0),
        "eyeLookY" to (input["eyeLookY"] ?: 0.0).coerceIn(-1.0, 1.0),
        "mouthOpen" to (input["mouthOpen"] ?: 0.0).coerceIn(0.0, 1.0),
        "mouthForm" to (input["mouthForm"] ?: 0.0).coerceIn(-1.0, 1.0),
        "browLeft" to (input["browLeft"] ?: 0.0).coerceIn(0.0, 1.0),
        "browRight" to (input["browRight"] ?: 0.0).coerceIn(0.0, 1.0),
        "trackingConfidence" to confidence(input),
    )

    private fun neutralState(trackingConfidence: Double): Map<String, Double> = mapOf(
        "headYaw" to 0.0,
        "headPitch" to 0.0,
        "headRoll" to 0.0,
        "eyeBlinkLeft" to 0.0,
        "eyeBlinkRight" to 0.0,
        "eyeLookX" to 0.0,
        "eyeLookY" to 0.0,
        "mouthOpen" to 0.0,
        "mouthForm" to 0.0,
        "browLeft" to 0.0,
        "browRight" to 0.0,
        "trackingConfidence" to trackingConfidence.coerceIn(0.0, 1.0),
    )

    private fun confidence(input: Map<String, Double>): Double {
        return (input["trackingConfidence"] ?: 0.0).coerceIn(0.0, 1.0)
    }

    private fun putSmoothed(
        destination: MutableMap<String, Double>,
        current: Map<String, Double>,
        target: Map<String, Double>,
        key: String,
        alpha: Double,
    ) {
        destination[key] = lerp(
            current[key] ?: 0.0,
            target[key] ?: 0.0,
            alpha,
        )
    }

    private fun lerp(from: Double, to: Double, alpha: Double): Double {
        return from + ((to - from) * alpha.coerceIn(0.0, 1.0))
    }

    companion object {
        private const val HEAD_ALPHA = 0.18
        private const val EYE_ALPHA = 0.45
        private const val BLINK_ALPHA = 0.68
        private const val MOUTH_ALPHA = 0.52
        private const val BROW_ALPHA = 0.35
        private const val CONFIDENCE_ALPHA = 0.25
    }
}
