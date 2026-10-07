package com.rohjoohoon.pocket_live2d_native

import android.content.Context
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.Handler
import android.os.Looper
import android.view.View
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

internal class PocketLive2dCubismRenderer(
    private val context: Context,
    private val assetKey: (String) -> String,
    private val onStatus: (Map<String, Any>) -> Unit,
) : PocketLive2dRenderer, GLSurfaceView.Renderer {
    private var surface: GLSurfaceView? = null
    private val main = Handler(Looper.getMainLooper())
    private var handle = 0L
    private var width = 1
    private var height = 1
    private var lastFrame = 0L
    private var loaded = false
    private var modelId = "mark"
    private var disposed = false

    fun attach(view: GLSurfaceView = GLSurfaceView(context)): View {
        check(surface == null) { "Only one app Live2D surface is supported per plugin" }
        disposed = false
        view.setEGLContextClientVersion(2)
        view.setEGLConfigChooser(8, 8, 8, 8, 0, 0)
        view.preserveEGLContextOnPause = true
        view.setRenderer(this)
        surface = view
        return view
    }

    fun detach() {
        val view = surface ?: return
        view.queueEvent {
            if (handle != 0L) PocketCubismJni.destroy(handle)
            handle = 0
            loaded = false
        }
        view.onPause()
        surface = null
    }

    override fun initialize() {
        check(PocketCubismJni.available()) { "sdk_unavailable: install Cubism Native 5-r.5 with tool/prepare_cubism.py" }
    }

    override fun loadModel(modelId: String) {
        require(modelId.matches(Regex("[a-zA-Z0-9_-]+"))) { "Invalid modelId" }
        this.modelId = modelId
        command { loadCurrentModel() }
    }

    private fun loadCurrentModel() {
        if (handle == 0L) return
        status("loading")
        PocketCubismJni.load(handle, assetKey("assets/live2d/$modelId/${modelId.replaceFirstChar { it.uppercase() }}.model3.json"), width, height)
        loaded = true
        status("loaded")
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        // A lost EGL context invalidates all old GPU objects. Recreate the model.
        if (handle != 0L) PocketCubismJni.destroy(handle)
        handle = 0
        loaded = false
        if (!PocketCubismJni.available()) {
            status("sdk_unavailable", "Cubism SDK/Core is not installed")
            return
        }
        guarded { handle = PocketCubismJni.create(context.assets) }
        lastFrame = 0
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        this.width = width.coerceAtLeast(1)
        this.height = height.coerceAtLeast(1)
        GLES20.glViewport(0, 0, this.width, this.height)
        guarded {
            if (handle == 0L) return@guarded
            if (loaded) PocketCubismJni.resize(handle, this.width, this.height)
            else loadCurrentModel()
        }
    }

    override fun onDrawFrame(gl: GL10?) {
        GLES20.glClearColor(0.92f, 0.96f, 0.94f, 1f)
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
        if (handle == 0L || !loaded) return
        val now = System.nanoTime()
        val delta = if (lastFrame == 0L) 1f / 60 else ((now - lastFrame) / 1e9).toFloat().coerceAtMost(.1f)
        lastFrame = now
        guarded { PocketCubismJni.draw(handle, delta) }
    }

    override fun playMotion(group: String, index: Int?) = command {
        PocketCubismJni.motion(handle, group, index ?: -1)
    }
    override fun setExpression(expressionId: String) = command {
        PocketCubismJni.expression(handle, expressionId)
    }
    override fun lookAt(x: Double, y: Double, active: Boolean) = command {
        PocketCubismJni.look(handle, x.toFloat(), y.toFloat(), active)
    }
    override fun tapAt(x: Double, y: Double) = command {
        PocketCubismJni.tap(handle, x.toFloat(), y.toFloat())
    }
    override fun applyOrientation(x: Double, y: Double, z: Double) = command {
        PocketCubismJni.orientation(handle, x.toFloat(), y.toFloat(), z.toFloat())
    }
    override fun applyFaceTracking(state: Map<String, Double>) {
        fun number(key: String) = (state[key] ?: 0.0).toFloat()
        val values = floatArrayOf(number("headYaw"), number("headPitch"), number("headRoll"),
            number("eyeLookX"), number("eyeLookY"), 1-number("eyeBlinkLeft"), 1-number("eyeBlinkRight"),
            number("mouthOpen"), number("mouthForm"), 0f, number("browLeft"), number("browRight"))
        command { PocketCubismJni.face(handle, values) }
    }
    override fun resetInput() = command { PocketCubismJni.reset(handle) }
    override fun setPaused(paused: Boolean) {
        lastFrame = 0
        if (paused) surface?.onPause() else surface?.onResume()
    }
    override fun dispose() { disposed = true; detach() }

    private fun command(action: () -> Unit) {
        surface?.queueEvent { if (handle != 0L && !disposed) guarded(action) }
    }
    private fun guarded(action: () -> Unit) {
        try { action() } catch (error: Exception) {
            loaded = false
            status("error", error.message ?: "Live2D renderer failed")
        }
    }
    private fun status(state: String, message: String? = null) {
        val event = mutableMapOf<String, Any>("state" to state, "modelId" to modelId)
        if (message != null) event["message"] = message
        main.post { if (!disposed) onStatus(event) }
    }
}
