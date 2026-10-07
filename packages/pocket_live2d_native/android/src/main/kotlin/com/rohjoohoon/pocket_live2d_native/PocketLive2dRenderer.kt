package com.rohjoohoon.pocket_live2d_native

internal interface PocketLive2dRenderer {
    fun initialize()
    fun loadModel(modelId: String)
    fun playMotion(group: String, index: Int?)
    fun setExpression(expressionId: String)
    fun lookAt(x: Double, y: Double, active: Boolean = true)
    fun tapAt(x: Double, y: Double)
    fun applyOrientation(x: Double, y: Double, z: Double)
    fun applyFaceTracking(state: Map<String, Double>)
    fun resetInput()
    fun setPaused(paused: Boolean)
    fun dispose()
}
