package com.rohjoohoon.pocket_live2d_native

import android.content.Context
import android.content.SharedPreferences
import android.opengl.GLSurfaceView
import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.view.MotionEvent
import android.view.SurfaceHolder
import kotlin.math.hypot

class PocketLive2dWallpaperService : WallpaperService() {
    override fun onCreateEngine(): Engine = WallpaperEngine()

    private inner class WallpaperEngine : Engine(), SharedPreferences.OnSharedPreferenceChangeListener {
        private val main = Handler(Looper.getMainLooper())
        private var visible = false
        private var destroyed = false
        private var glView: WallpaperSurfaceView? = null
        private var renderer: PocketLive2dCubismRenderer? = null
        private var orientation: PocketLive2dOrientationController? = null
        private val preferences by lazy { getSharedPreferences("pocket_live2d", Context.MODE_PRIVATE) }
        private var downX = 0f
        private var downY = 0f
        private var dragged = false
        private val drawFrame = object : Runnable {
            override fun run() {
                if (!visible || destroyed) return
                glView?.requestRender()
                main.postDelayed(this, 33L)
            }
        }

        override fun onCreate(holder: SurfaceHolder) {
            super.onCreate(holder)
            setTouchEventsEnabled(true)
            val render = PocketLive2dCubismRenderer(
                this@PocketLive2dWallpaperService,
                { key -> "flutter_assets/$key" },
                { event ->
                    // A Wallpaper Engine has no Flutter channel or camera.
                    if (event["state"] == "error" || event["state"] == "sdk_unavailable") {
                        orientation?.stop()
                    }
                },
            )
            renderer = render
            val surface = WallpaperSurfaceView(this@PocketLive2dWallpaperService)
            render.attach(surface)
            surface.renderMode = GLSurfaceView.RENDERMODE_WHEN_DIRTY
            glView = surface
            orientation = PocketLive2dOrientationController(this@PocketLive2dWallpaperService) { state ->
                val sensitivity = preferences.getFloat("sensitivity", 1f).toDouble()
                render.applyOrientation(
                    ((state["x"] as? Number)?.toDouble() ?: 0.0) * sensitivity,
                    ((state["y"] as? Number)?.toDouble() ?: 0.0) * sensitivity,
                    ((state["z"] as? Number)?.toDouble() ?: 0.0) * sensitivity,
                )
            }
            preferences.registerOnSharedPreferenceChangeListener(this)
            render.loadModel(preferences.getString("wallpaper_model", "mark") ?: "mark")
        }

        override fun onVisibilityChanged(isVisible: Boolean) {
            visible = isVisible
            main.removeCallbacks(drawFrame)
            renderer?.setPaused(!isVisible)
            if (isVisible && !destroyed) {
                orientation?.start()
                main.post(drawFrame)
            } else {
                orientation?.stop()
                renderer?.resetInput()
            }
        }

        override fun onSharedPreferenceChanged(prefs: SharedPreferences?, key: String?) {
            if (key == "wallpaper_model") {
                renderer?.loadModel(preferences.getString(key, "mark") ?: "mark")
            }
        }

        override fun onTouchEvent(event: MotionEvent) {
            if (!visible || destroyed) return
            val frame = surfaceHolder.surfaceFrame
            if (frame.width() <= 0 || frame.height() <= 0) return
            val x = (event.x / frame.width() * 2 - 1).coerceIn(-1f, 1f).toDouble()
            val y = (1 - event.y / frame.height() * 2).coerceIn(-1f, 1f).toDouble()
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.x; downY = event.y; dragged = false
                    renderer?.lookAt(x, y, true)
                }
                MotionEvent.ACTION_MOVE -> {
                    if (hypot(event.x-downX,event.y-downY) > 16) dragged = true
                    renderer?.lookAt(x, y, true)
                }
                MotionEvent.ACTION_UP -> {
                    if (!dragged) renderer?.tapAt(x,y)
                    renderer?.lookAt(0.0,0.0,false)
                }
                MotionEvent.ACTION_CANCEL -> renderer?.lookAt(0.0,0.0,false)
            }
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder) {
            visible = false
            main.removeCallbacks(drawFrame)
            orientation?.stop()
            renderer?.setPaused(true)
            super.onSurfaceDestroyed(holder)
        }

        override fun onDestroy() {
            destroyed = true; visible = false
            main.removeCallbacks(drawFrame)
            preferences.unregisterOnSharedPreferenceChangeListener(this)
            orientation?.stop()
            renderer?.dispose()
            glView?.release()
            glView = null; renderer = null
            super.onDestroy()
        }

        private inner class WallpaperSurfaceView(context: Context) : GLSurfaceView(context) {
            override fun getHolder(): SurfaceHolder = this@WallpaperEngine.surfaceHolder
            fun release() { super.onDetachedFromWindow() }
        }
    }
}
