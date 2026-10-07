package com.rohjoohoon.pocket_live2d_native

import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class PocketLive2dNativePlugin : FlutterPlugin, MethodChannel.MethodCallHandler {
    private lateinit var methodChannel: MethodChannel
    private lateinit var faceTrackingChannel: EventChannel
    private lateinit var orientationChannel: EventChannel
    private lateinit var orientationController: PocketLive2dOrientationController

    private val faceTrackingStreamHandler = PocketLive2dStreamHandler()
    private val orientationStreamHandler = PocketLive2dStreamHandler()

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
            orientationStreamHandler.emit(event)
        }

        binding.platformViewRegistry.registerViewFactory(
            VIEW_TYPE,
            PocketLive2dViewFactory(),
        )
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "initialize" -> result.success(null)
            "loadModel" -> handleLoadModel(call, result)
            "playMotion" -> handlePlayMotion(call, result)
            "setExpression" -> handleSetExpression(call, result)
            "setGyroEnabled" -> handleSetGyroEnabled(call, result)
            "setMimicEnabled" -> handleSetMimicEnabled(call, result)
            "lookAt" -> handleLookAt(call, result)
            "dispose" -> {
                orientationController.stop()
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

        // TODO: Route to the Cubism model repository once the SDK is linked.
        result.success(null)
    }

    private fun handlePlayMotion(call: MethodCall, result: MethodChannel.Result) {
        val group = call.argument<String>("group")
        if (group.isNullOrBlank()) {
            result.error("invalid_argument", "group is required", null)
            return
        }

        // TODO: Route group/index to the Cubism motion controller.
        result.success(null)
    }

    private fun handleSetExpression(call: MethodCall, result: MethodChannel.Result) {
        val expressionId = call.argument<String>("expressionId")
        if (expressionId.isNullOrBlank()) {
            result.error("invalid_argument", "expressionId is required", null)
            return
        }

        // TODO: Route to Cubism expression handling.
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

        // TODO: Start/stop CameraX face tracking in app mode only.
        result.success(null)
    }

    private fun handleLookAt(call: MethodCall, result: MethodChannel.Result) {
        val x = call.argument<Number>("x")?.toDouble()
        val y = call.argument<Number>("y")?.toDouble()
        if (x == null || y == null) {
            result.error("invalid_argument", "x and y are required", null)
            return
        }

        // TODO: Route normalized coordinates to ParamEyeBallX/Y and head target.
        result.success(null)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        orientationController.stop()
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
    }
}
