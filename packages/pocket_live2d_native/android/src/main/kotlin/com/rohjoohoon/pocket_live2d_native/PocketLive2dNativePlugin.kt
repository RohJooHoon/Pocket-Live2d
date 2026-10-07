package com.rohjoohoon.pocket_live2d_native

import android.Manifest
import android.app.Activity
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.PluginRegistry

class PocketLive2dNativePlugin :
    FlutterPlugin,
    MethodChannel.MethodCallHandler,
    ActivityAware,
    PluginRegistry.RequestPermissionsResultListener,
    DefaultLifecycleObserver {

    private lateinit var methodChannel: MethodChannel
    private lateinit var faceTrackingChannel: EventChannel
    private lateinit var orientationChannel: EventChannel
    private lateinit var orientationController: PocketLive2dOrientationController
    private lateinit var faceTrackingController: PocketLive2dFaceTrackingController

    private val faceTrackingStreamHandler = PocketLive2dStreamHandler()
    private val orientationStreamHandler = PocketLive2dStreamHandler()
    private lateinit var renderer: PocketLive2dCubismRenderer
    private lateinit var shakeController: PocketLive2dShakeController
    private val statusStreamHandler = PocketLive2dStreamHandler()
    private lateinit var statusChannel: EventChannel
    private var initialized = false

    private var activityBinding: ActivityPluginBinding? = null
    private var activity: Activity? = null
    private var pendingMimicPermissionResult: MethodChannel.Result? = null
    private var pendingMimicStartResult: MethodChannel.Result? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        renderer = PocketLive2dCubismRenderer(
            binding.applicationContext,
            { path -> binding.flutterAssets.getAssetFilePathByName(path) },
            statusStreamHandler::emit,
        )
        shakeController = PocketLive2dShakeController(binding.applicationContext) {
            renderer.playMotion("Shake", null)
        }
        statusChannel = EventChannel(binding.binaryMessenger, "pocket_live2d/status")
        statusChannel.setStreamHandler(statusStreamHandler)
        methodChannel = MethodChannel(binding.binaryMessenger, METHOD_CHANNEL)
        methodChannel.setMethodCallHandler(this)

        faceTrackingChannel = EventChannel(binding.binaryMessenger, FACE_TRACKING_CHANNEL)
        faceTrackingChannel.setStreamHandler(faceTrackingStreamHandler)

        orientationChannel = EventChannel(binding.binaryMessenger, ORIENTATION_CHANNEL)
        orientationChannel.setStreamHandler(orientationStreamHandler)

        orientationController = PocketLive2dOrientationController(
            binding.applicationContext,
        ) { event ->
            renderer.applyOrientation(
                x = (event["x"] as? Number)?.toDouble() ?: 0.0,
                y = (event["y"] as? Number)?.toDouble() ?: 0.0,
                z = (event["z"] as? Number)?.toDouble() ?: 0.0,
            )
            orientationStreamHandler.emit(event)
        }

        faceTrackingController = PocketLive2dFaceTrackingController(
            binding.applicationContext,
            onState = { state ->
                renderer.applyFaceTracking(state)
                faceTrackingStreamHandler.emit(state)
            },
            onError = { code, message ->
                val startup = pendingMimicStartResult
                pendingMimicStartResult = null
                faceTrackingController.stop()
                if (startup != null) {
                    startup.error(code, message, null)
                } else {
                    faceTrackingStreamHandler.emitError(code, message)
                }
            },
        )

        binding.platformViewRegistry.registerViewFactory(
            VIEW_TYPE,
            PocketLive2dViewFactory(renderer),
        )
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
        when (call.method) {
            "initialize" -> {
                renderer.initialize()
                initialized = true
                shakeController.start()
                result.success(null)
            }
            "loadModel" -> handleLoadModel(call, result)
            "playMotion" -> handlePlayMotion(call, result)
            "setExpression" -> handleSetExpression(call, result)
            "setGyroEnabled" -> handleSetGyroEnabled(call, result)
            "setMimicEnabled" -> handleSetMimicEnabled(call, result)
            "lookAt" -> handleLookAt(call, result)
            "tapAt" -> {
                val x = call.argument<Number>("x")?.toDouble()
                val y = call.argument<Number>("y")?.toDouble()
                require(x != null && y != null) { "x and y are required" }
                renderer.tapAt(x, y)
                result.success(null)
            }
            "setWallpaper" -> {
                val current = requireNotNull(activity) { "A foreground Activity is required" }
                require(PocketCubismJni.available()) { "Cubism SDK/Core is not installed" }
                val model = call.argument<String>("modelId") ?: "mark"
                require(model.matches(Regex("[a-zA-Z0-9_-]+"))) { "Invalid modelId" }
                current.getSharedPreferences("pocket_live2d", Activity.MODE_PRIVATE).edit()
                    .putString("wallpaper_model", model).commit()
                val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).putExtra(
                    WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                    ComponentName(current, PocketLive2dWallpaperService::class.java),
                )
                current.startActivity(intent)
                result.success(null)
            }
            "dispose" -> {
                stopInteractiveInputs()
                shakeController.stop()
                initialized = false
                renderer.dispose()
                faceTrackingStreamHandler.clear()
                orientationStreamHandler.clear()
                result.success(null)
            }
            else -> result.notImplemented()
        }
        } catch (error: IllegalArgumentException) {
            result.error("invalid_argument", error.message, null)
        } catch (error: Exception) {
            result.error(if (error.message?.contains("sdk_unavailable") == true) "sdk_unavailable" else "native_error", error.message, null)
        }
    }

    private fun handleLoadModel(call: MethodCall, result: MethodChannel.Result) {
        val modelId = call.argument<String>("modelId")
        if (modelId.isNullOrBlank()) {
            result.error("invalid_argument", "modelId is required", null)
            return
        }

        renderer.loadModel(modelId)
        result.success(null)
    }

    private fun handlePlayMotion(call: MethodCall, result: MethodChannel.Result) {
        val group = call.argument<String>("group")
        if (group.isNullOrBlank()) {
            result.error("invalid_argument", "group is required", null)
            return
        }

        renderer.playMotion(group, call.argument<Int>("index"))
        result.success(null)
    }

    private fun handleSetExpression(call: MethodCall, result: MethodChannel.Result) {
        val expressionId = call.argument<String>("expressionId")
        if (expressionId.isNullOrBlank()) {
            result.error("invalid_argument", "expressionId is required", null)
            return
        }

        renderer.setExpression(expressionId)
        result.success(null)
    }

    private fun handleSetGyroEnabled(call: MethodCall, result: MethodChannel.Result) {
        val enabled = call.argument<Boolean>("enabled")
        if (enabled == null) {
            result.error("invalid_argument", "enabled is required", null)
            return
        }

        if (!enabled) {
            orientationController.stop()
            renderer.resetInput()
            result.success(null)
            return
        }

        if ((activity as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(androidx.lifecycle.Lifecycle.State.STARTED) != true) {
            result.error("app_in_background", "Interactive inputs require a foreground app", null)
            return
        }
        faceTrackingController.stop()

        if (!orientationController.isSupported) {
            result.error(
                "sensor_unavailable",
                "Rotation Vector sensor is not available on this device",
                null,
            )
            return
        }

        if (!orientationController.start()) {
            result.error(
                "sensor_start_failed",
                "Failed to register Rotation Vector sensor listener",
                null,
            )
            return
        }

        result.success(null)
    }

    private fun handleSetMimicEnabled(call: MethodCall, result: MethodChannel.Result) {
        val enabled = call.argument<Boolean>("enabled")
        if (enabled == null) {
            result.error("invalid_argument", "enabled is required", null)
            return
        }

        if (!enabled) {
            faceTrackingController.stop()
            renderer.resetInput()
            resolvePendingPermissionRequestAsCancelled()
            result.success(null)
            return
        }

        if ((activity as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(androidx.lifecycle.Lifecycle.State.STARTED) != true) {
            result.error("app_in_background", "Interactive inputs require a foreground app", null)
            return
        }
        orientationController.stop()

        if (!faceTrackingController.isSupported) {
            result.error(
                "face_tracking_unavailable",
                "MediaPipe face tracking requires Android 7.0 (API 24) or newer",
                null,
            )
            return
        }

        val currentActivity = activity
        if (currentActivity == null) {
            result.error(
                "activity_unavailable",
                "Mimic mode requires a foreground Android Activity",
                null,
            )
            return
        }

        if (
            ContextCompat.checkSelfPermission(
                currentActivity,
                Manifest.permission.CAMERA,
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            startMimic(currentActivity, result)
            return
        }

        if (pendingMimicPermissionResult != null) {
            result.error(
                "permission_request_in_progress",
                "A camera permission request is already in progress",
                null,
            )
            return
        }

        pendingMimicPermissionResult = result
        ActivityCompat.requestPermissions(
            currentActivity,
            arrayOf(Manifest.permission.CAMERA),
            CAMERA_PERMISSION_REQUEST_CODE,
        )
    }

    private fun startMimic(currentActivity: Activity, result: MethodChannel.Result) {
        if (pendingMimicStartResult != null) {
            result.error("tracking_start_in_progress", "Face tracking is already starting", null)
            return
        }
        pendingMimicStartResult = result
        faceTrackingController.start(currentActivity) {
            pendingMimicStartResult?.success(null)
            pendingMimicStartResult = null
        }
    }

    private fun handleLookAt(call: MethodCall, result: MethodChannel.Result) {
        val x = call.argument<Number>("x")?.toDouble()
        val y = call.argument<Number>("y")?.toDouble()
        if (x == null || y == null) {
            result.error("invalid_argument", "x and y are required", null)
            return
        }

        renderer.lookAt(x.coerceIn(-1.0, 1.0), y.coerceIn(-1.0, 1.0), call.argument<Boolean>("active") ?: true)
        result.success(null)
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        attachActivity(binding)
    }

    override fun onDetachedFromActivityForConfigChanges() {
        detachActivity()
    }

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
        attachActivity(binding)
    }

    override fun onDetachedFromActivity() {
        detachActivity()
    }

    private fun attachActivity(binding: ActivityPluginBinding) {
        activityBinding = binding
        activity = binding.activity
        binding.addRequestPermissionsResultListener(this)
        (binding.activity as? LifecycleOwner)?.lifecycle?.addObserver(this)
    }

    private fun detachActivity() {
        stopInteractiveInputs()
        shakeController.stop()
        renderer.setPaused(true)
        (activity as? LifecycleOwner)?.lifecycle?.removeObserver(this)
        activityBinding?.removeRequestPermissionsResultListener(this)
        activityBinding = null
        activity = null
        resolvePendingPermissionRequestAsCancelled()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ): Boolean {
        if (requestCode != CAMERA_PERMISSION_REQUEST_CODE) return false

        val pendingResult = pendingMimicPermissionResult
        pendingMimicPermissionResult = null

        if (pendingResult == null) return true

        val granted = grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED

        if (!granted) {
            pendingResult.error(
                "camera_permission_denied",
                "Camera permission is required for Mimic mode",
                null,
            )
            return true
        }

        val currentActivity = activity
        if (currentActivity == null) {
            pendingResult.error(
                "activity_unavailable",
                "Mimic mode requires a foreground Android Activity",
                null,
            )
            return true
        }

        startMimic(currentActivity, pendingResult)
        return true
    }

    private fun resolvePendingPermissionRequestAsCancelled() {
        pendingMimicStartResult?.error(
            "face_tracking_start_cancelled", "Face tracking startup was cancelled", null,
        )
        pendingMimicStartResult = null
        pendingMimicPermissionResult?.error(
            "camera_permission_cancelled",
            "Camera permission request was cancelled",
            null,
        )
        pendingMimicPermissionResult = null
    }

    override fun onStop(owner: LifecycleOwner) {
        stopInteractiveInputs()
        shakeController.stop()
        renderer.setPaused(true)
    }

    override fun onStart(owner: LifecycleOwner) {
        renderer.setPaused(false)
        if (initialized) shakeController.start()
    }

    private fun stopInteractiveInputs() {
        orientationController.stop()
        faceTrackingController.stop()
        renderer.resetInput()
        resolvePendingPermissionRequestAsCancelled()
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        stopInteractiveInputs()
        faceTrackingController.dispose()
        shakeController.stop()
        statusChannel.setStreamHandler(null)
        renderer.dispose()
        methodChannel.setMethodCallHandler(null)
        faceTrackingChannel.setStreamHandler(null)
        orientationChannel.setStreamHandler(null)
        faceTrackingStreamHandler.clear()
        orientationStreamHandler.clear()
    }

    companion object {
        const val METHOD_CHANNEL = "pocket_live2d/live2d"
        const val FACE_TRACKING_CHANNEL = "pocket_live2d/face_tracking"
        const val ORIENTATION_CHANNEL = "pocket_live2d/orientation"
        const val VIEW_TYPE = "pocket_live2d/view"

        private const val CAMERA_PERMISSION_REQUEST_CODE = 42621
    }
}
