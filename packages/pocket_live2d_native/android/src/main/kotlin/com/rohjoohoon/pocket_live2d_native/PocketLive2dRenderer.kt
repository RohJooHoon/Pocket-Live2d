package com.rohjoohoon.pocket_live2d_native

internal interface PocketLive2dRenderer {
    fun initialize()
    fun loadModel(modelId: String)
    fun playMotion(group: String, index: Int?)
    fun setExpression(expressionId: String)
    fun lookAt(x: Double, y: Double)
    fun applyOrientation(x: Double, y: Double, z: Double)
    fun applyFaceTracking(state: Map<String, Double>)
    fun dispose()
}

/**
 * Temporary implementation used until the Cubism SDK/Core is linked locally.
 * Keeping this adapter in place lets sensors, channels and UI evolve without
 * depending directly on Cubism classes.
 */
internal class PendingCubismRenderer : PocketLive2dRenderer {
    override fun initialize() = Unit
    override fun loadModel(modelId: String) = Unit
    override fun playMotion(group: String, index: Int?) = Unit
    override fun setExpression(expressionId: String) = Unit
    override fun lookAt(x: Double, y: Double) = Unit
    override fun applyOrientation(x: Double, y: Double, z: Double) = Unit
    override fun applyFaceTracking(state: Map<String, Double>) = Unit
    override fun dispose() = Unit
}
