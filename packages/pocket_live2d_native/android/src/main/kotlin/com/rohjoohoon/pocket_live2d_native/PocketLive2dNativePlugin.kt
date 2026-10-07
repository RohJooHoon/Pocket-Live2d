package com.rohjoohoon.pocket_live2d_native

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.StandardMessageCodec
import io.flutter.plugin.platform.PlatformView
import io.flutter.plugin.platform.PlatformViewFactory

class PocketLive2dNativePlugin : FlutterPlugin, MethodChannel.MethodCallHandler, ActivityAware, Application.ActivityLifecycleCallbacks {
    private lateinit var methods: MethodChannel
    private lateinit var orientationEvents: EventChannel
    private lateinit var faceEvents: EventChannel
    private lateinit var orientation: OrientationSource
    private lateinit var application: Application
    private var activity: Activity? = null
    private var initialized = false
    private var appActive = true
    private var resumed = false
    private val surfaces = mutableMapOf<Int, DiagnosticSurface>()
    private var parameters: Map<String, Double> = emptyMap()

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        application = binding.applicationContext as Application
        application.registerActivityLifecycleCallbacks(this)
        orientation = OrientationSource(binding.applicationContext)
        methods = MethodChannel(binding.binaryMessenger, "pocket_live2d/live2d")
        methods.setMethodCallHandler(this)
        orientationEvents = EventChannel(binding.binaryMessenger, "pocket_live2d/orientation")
        orientationEvents.setStreamHandler(orientation)
        faceEvents = EventChannel(binding.binaryMessenger, "pocket_live2d/face_tracking")
        faceEvents.setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(arguments: Any?, events: EventChannel.EventSink) = Unit
            override fun onCancel(arguments: Any?) = Unit
        })
        binding.platformViewRegistry.registerViewFactory("pocket_live2d/surface", object : PlatformViewFactory(StandardMessageCodec.INSTANCE) {
            override fun create(context: Context, viewId: Int, args: Any?): PlatformView {
                return DiagnosticSurface(context) { surfaces.remove(viewId) }.also {
                    surfaces[viewId] = it
                    it.update(parameters)
                }
            }
        })
    }

    private fun updateActivity() {
        orientation.active = initialized && appActive && resumed && activity != null
        orientation.update()
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        if (call.method == "initialize") {
            initialized = true
            updateActivity()
            result.success(mapOf("nativeSurface" to true, "gyro" to orientation.available,
                "renderer" to false, "mimic" to false, "wallpaper" to false))
            return
        }
        if (call.method == "dispose") {
            initialized = false
            orientation.dispose()
            parameters = emptyMap()
            surfaces.values.forEach { it.update(parameters) }
            result.success(null)
            return
        }
        if (!initialized) {
            result.error("not_initialized", "Call initialize first", null)
            return
        }
        when (call.method) {
            "setGyroEnabled" -> {
                val enabled = call.argument<Boolean>("enabled")
                if (enabled == null) return result.error("invalid_arguments", "enabled is required", null)
                if (enabled && !orientation.available) return result.error("sensor_unavailable", "Rotation sensor unavailable", null)
                orientation.enabled = enabled
                updateActivity()
                result.success(null)
            }
            "setActive" -> {
                val active = call.argument<Boolean>("active")
                if (active == null) return result.error("invalid_arguments", "active is required", null)
                appActive = active
                updateActivity()
                result.success(null)
            }
            "calibrate" -> { orientation.calibrate(); result.success(null) }
            "setParameters" -> {
                val values = call.arguments as? Map<*, *>
                if (values == null || values.any { it.key !is String || it.value !is Number || !(it.value as Number).toDouble().isFinite() }) {
                    result.error("invalid_arguments", "Parameters must be finite numeric values", null)
                    return
                }
                parameters = values.entries.associate { it.key as String to (it.value as Number).toDouble() }
                if (appActive) surfaces.values.forEach { it.update(parameters) }
                result.success(null)
            }
            "lookAt" -> {
                val x = call.argument<Number>("x")?.toDouble()
                val y = call.argument<Number>("y")?.toDouble()
                if (x == null || y == null || !x.isFinite() || !y.isFinite()) return result.error("invalid_arguments", "Finite x/y required", null)
                parameters = parameters + mapOf("ParamEyeBallX" to x.coerceIn(-1.0, 1.0), "ParamEyeBallY" to y.coerceIn(-1.0, 1.0))
                if (appActive) surfaces.values.forEach { it.update(parameters) }
                result.success(null)
            }
            "setMimicEnabled" -> {
                if (call.argument<Boolean>("enabled") == false) result.success(null)
                else result.error("mimic_unavailable", "Face tracking adapter is not installed", null)
            }
            "loadModel", "playMotion", "setExpression" -> result.error("renderer_unavailable", "Install the Cubism renderer and model assets first", null)
            "setWallpaper" -> result.error("wallpaper_unavailable", "Wallpaper service is not installed", null)
            else -> result.notImplemented()
        }
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        orientation.dispose()
        methods.setMethodCallHandler(null)
        orientationEvents.setStreamHandler(null)
        faceEvents.setStreamHandler(null)
        application.unregisterActivityLifecycleCallbacks(this)
        surfaces.clear()
        activity = null
        initialized = false
    }
    override fun onAttachedToActivity(binding: ActivityPluginBinding) { activity = binding.activity; updateActivity() }
    override fun onDetachedFromActivityForConfigChanges() = onDetachedFromActivity()
    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) = onAttachedToActivity(binding)
    override fun onDetachedFromActivity() { activity = null; resumed = false; updateActivity() }
    override fun onActivityResumed(activity: Activity) { if (activity === this.activity) { resumed = true; updateActivity() } }
    override fun onActivityPaused(activity: Activity) { if (activity === this.activity) { resumed = false; updateActivity() } }
    override fun onActivityCreated(activity: Activity, state: Bundle?) = Unit
    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) { if (activity === this.activity) onDetachedFromActivity() }
}
