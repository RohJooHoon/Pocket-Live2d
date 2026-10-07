package com.rohjoohoon.pocket_live2d_native

import android.Manifest
import android.app.Activity
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
    PluginRegistry.RequestPermissionsResultListener {

    private lateinit var methodChannel: MethodChannel
    private lateinit var faceTrackingChannel: EventChannel
    private lateinit var orientationChannel: EventChannel
    private lateinit var orientationController: PocketLive2dOrientationController
    private lateinit var faceTrackingController: PocketLive2dFaceTrackingController

    private val faceTrackingStreamHandler = PocketLive2dStreamHandler()
    private val orientationStreamHandler = PocketLive2dStreamHandler()
    private val renderer: PocketLive2dRenderer = PendingCubismRenderer()

    private var activityBinding: ActivityPluginBinding? = null
    private var activity: Activity? = null
    private var pendingMimicPermissionResult: MethodChannel.Result? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
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
                faceTrackingStreamHandler.emitError(code, message)
            },
        )

        binding.platformViewRegistry.registerViewFactory(
            VIEW_TYPE,
            PocketLive2dViewFactory(renderer),
        )
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "initialize" -> {
                renderer.initialize()
                result.success(null)
            }
            "loadModel" -> handleLoadModel(call, result)
            "playMotion" -> handlePlayMotion(call, result)
            "setExpression" -> handleSetExpression(call, result)
            "setGyroEnabled" -> handleSetGyroEnabled(call, result)
            "setMimicEnabled" -> handleSetMimicEnabled(call, result)
            "lookAt" -> handleLookAt(call, result)
            "dispose" -> {
                stopInteractiveInputs()
                renderer.dispose()
                faceTrackingStreamHandler.clear()
                orientationStreamHandler.clear()
                result.success(null)
            }
            else -> result.notImplemented()
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
            result.success(null)
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
            resolvePendingPermissionRequestAsCancelled()
            result.success(null)
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
            startMimic(currentActivity)
            result.success(null)
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

    private fun startMimic(currentActivity: Activity) {
        faceTrackingController.start(currentActivity) {
            // Startup completion is primarily surfaced through the MethodChannel.
            // Runtime tracking failures continue through the EventChannel.
        }
    }

    private fun handleLookAt(call: MethodCall, result: MethodChannel.Result) {
        val x = call.argument<Number>("x")?.toDouble()
        val y = call.argument<Number>("y")?.toDouble()
        if (x == null || y == null) {
            result.error("invalid_argument", "x and y are required", null)
            return
        }

        renderer.lookAt(x.coerceIn(-1.0, 1.0), y.coerceIn(-1.0, 1.0))
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
    }

    private fun detachActivity() {
        faceTrackingController.stop()
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

        startMimic(currentActivity)
        pendingResult.success(null)
        return true
    }

    private fun resolvePendingPermissionRequestAsCancelled() {
        pendingMimicPermissionResult?.error(
            "camera_permission_cancelled",
            "Camera permission request was cancelled",
            null,
        )
        pendingMimicPermissionResult = null
    }

    private fun stopInteractiveInputs() {
        orientationController.stop()
        faceTrackingController.stop()
        resolvePendingPermissionRequestAsCancelled()
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        stopInteractiveInputs()
        faceTrackingController.dispose()
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
