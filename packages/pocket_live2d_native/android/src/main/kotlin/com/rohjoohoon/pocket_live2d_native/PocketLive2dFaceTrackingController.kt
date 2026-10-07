package com.rohjoohoon.pocket_live2d_native

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Build
import android.os.SystemClock
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.atan2
import kotlin.math.sqrt

internal class PocketLive2dFaceTrackingController(
    context: Context,
    private val onState: (Map<String, Double>) -> Unit,
    private val onError: (String, String) -> Unit,
) {
    private val applicationContext = context.applicationContext
    private val mainExecutor = ContextCompat.getMainExecutor(applicationContext)
    private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val filter = PocketLive2dFaceTrackingFilter()

    private var faceLandmarker: FaceLandmarker? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageAnalysis: ImageAnalysis? = null

    @Volatile
    private var active = false

    private var sessionId = 0L

    val isSupported: Boolean
        get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N

    fun start(
        activity: Activity,
        onStarted: () -> Unit,
    ) {
        if (!isSupported) {
            onError(
                "face_tracking_unavailable",
                "MediaPipe face tracking requires Android 7.0 (API 24) or newer",
            )
            return
        }

        val lifecycleOwner = activity as? LifecycleOwner
        if (lifecycleOwner == null) {
            onError(
                "lifecycle_unavailable",
                "The current Android Activity is not a LifecycleOwner",
            )
            return
        }

        stop()
        filter.reset()
        active = true
        val token = ++sessionId

        analysisExecutor.execute {
            try {
                val landmarker = createFaceLandmarker()
                if (!isSessionActive(token)) {
                    landmarker.close()
                    return@execute
                }

                faceLandmarker = landmarker
                bindCamera(activity, lifecycleOwner, token, onStarted)
            } catch (error: Exception) {
                reportError(
                    token,
                    "face_tracking_start_failed",
                    error.message ?: "Failed to initialize MediaPipe Face Landmarker",
                )
            }
        }
    }

    fun stop() {
        active = false
        sessionId += 1
        filter.reset()

        imageAnalysis?.clearAnalyzer()
        imageAnalysis = null

        mainExecutor.execute {
            cameraProvider?.unbindAll()
            cameraProvider = null
        }

        val landmarker = faceLandmarker
        faceLandmarker = null
        if (landmarker != null && !analysisExecutor.isShutdown) {
            analysisExecutor.execute {
                landmarker.close()
            }
        }
    }

    fun dispose() {
        stop()
        analysisExecutor.shutdown()
    }

    private fun createFaceLandmarker(): FaceLandmarker {
        val baseOptions = BaseOptions.builder()
            .setDelegate(Delegate.CPU)
            .setModelAssetPath(MODEL_ASSET_NAME)
            .build()

        val options = FaceLandmarker.FaceLandmarkerOptions.builder()
            .setBaseOptions(baseOptions)
            .setMinFaceDetectionConfidence(0.5f)
            .setMinTrackingConfidence(0.5f)
            .setMinFacePresenceConfidence(0.5f)
            .setNumFaces(1)
            .setOutputFaceBlendshapes(true)
            .setOutputFacialTransformationMatrixes(true)
            .setRunningMode(RunningMode.LIVE_STREAM)
            .setResultListener { result, _ -> handleResult(result) }
            .setErrorListener { error ->
                val token = sessionId
                reportError(
                    token,
                    "face_tracking_failed",
                    error.message ?: "MediaPipe face tracking failed",
                )
            }
            .build()

        return FaceLandmarker.createFromOptions(applicationContext, options)
    }

    private fun bindCamera(
        activity: Activity,
        lifecycleOwner: LifecycleOwner,
        token: Long,
        onStarted: () -> Unit,
    ) {
        val providerFuture = ProcessCameraProvider.getInstance(applicationContext)
        providerFuture.addListener(
            {
                if (!isSessionActive(token)) return@addListener

                try {
                    val provider = providerFuture.get()
                    val analyzer = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                        .build()

                    analyzer.setAnalyzer(analysisExecutor) { imageProxy ->
                        analyzeFrame(imageProxy, token)
                    }

                    provider.unbindAll()
                    provider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_FRONT_CAMERA,
                        analyzer,
                    )

                    if (!isSessionActive(token)) {
                        provider.unbindAll()
                        analyzer.clearAnalyzer()
                        return@addListener
                    }

                    cameraProvider = provider
                    imageAnalysis = analyzer
                    onStarted()
                } catch (error: Exception) {
                    reportError(
                        token,
                        "camera_start_failed",
                        error.message ?: "Failed to start front camera",
                    )
                }
            },
            ContextCompat.getMainExecutor(activity),
        )
    }

    private fun analyzeFrame(imageProxy: ImageProxy, token: Long) {
        if (!isSessionActive(token)) {
            imageProxy.close()
            return
        }

        val width = imageProxy.width
        val height = imageProxy.height
        val rotationDegrees = imageProxy.imageInfo.rotationDegrees

        try {
            val bitmapBuffer = Bitmap.createBitmap(
                width,
                height,
                Bitmap.Config.ARGB_8888,
            )

            imageProxy.use {
                bitmapBuffer.copyPixelsFromBuffer(it.planes[0].buffer)
            }

            val transform = Matrix().apply {
                postRotate(rotationDegrees.toFloat())
                postScale(
                    -1f,
                    1f,
                    width.toFloat(),
                    height.toFloat(),
                )
            }

            val rotatedBitmap = Bitmap.createBitmap(
                bitmapBuffer,
                0,
                0,
                bitmapBuffer.width,
                bitmapBuffer.height,
                transform,
                true,
            )

            val mpImage = BitmapImageBuilder(rotatedBitmap).build()
            faceLandmarker?.detectAsync(mpImage, SystemClock.uptimeMillis())
        } catch (error: Exception) {
            if (!imageProxyIsClosed(imageProxy)) {
                imageProxy.close()
            }
            reportError(
                token,
                "frame_processing_failed",
                error.message ?: "Failed to process camera frame",
            )
        }
    }

    private fun handleResult(result: FaceLandmarkerResult) {
        val token = sessionId
        if (!isSessionActive(token)) return

        if (result.faceLandmarks().isEmpty()) {
            emitState(token, filter.apply(idleState()))
            return
        }

        val blendshapes = result.faceBlendshapes()
            .orElse(emptyList())
            .firstOrNull()
            .orEmpty()
            .associate { category ->
                category.categoryName() to category.score().toDouble()
            }

        val transform = result.facialTransformationMatrixes()
            .orElse(emptyList())
            .firstOrNull()

        val headPose = transform?.let(::eulerDegrees)
            ?: HeadPose(0.0, 0.0, 0.0)

        val lookRight = average(
            score(blendshapes, "eyeLookInLeft"),
            score(blendshapes, "eyeLookOutRight"),
        )
        val lookLeft = average(
            score(blendshapes, "eyeLookOutLeft"),
            score(blendshapes, "eyeLookInRight"),
        )
        val lookUp = average(
            score(blendshapes, "eyeLookUpLeft"),
            score(blendshapes, "eyeLookUpRight"),
        )
        val lookDown = average(
            score(blendshapes, "eyeLookDownLeft"),
            score(blendshapes, "eyeLookDownRight"),
        )

        val smile = average(
            score(blendshapes, "mouthSmileLeft"),
            score(blendshapes, "mouthSmileRight"),
        )
        val frown = average(
            score(blendshapes, "mouthFrownLeft"),
            score(blendshapes, "mouthFrownRight"),
        )

        val state = mapOf(
            "headYaw" to headPose.yaw,
            "headPitch" to headPose.pitch,
            "headRoll" to headPose.roll,
            "eyeBlinkLeft" to clamp01(score(blendshapes, "eyeBlinkLeft")),
            "eyeBlinkRight" to clamp01(score(blendshapes, "eyeBlinkRight")),
            "eyeLookX" to clampUnit(lookRight - lookLeft),
            "eyeLookY" to clampUnit(lookUp - lookDown),
            "mouthOpen" to clamp01(score(blendshapes, "jawOpen")),
            "mouthForm" to clampUnit(smile - frown),
            "browLeft" to clamp01(
                maxOf(
                    score(blendshapes, "browOuterUpLeft"),
                    score(blendshapes, "browInnerUp"),
                ),
            ),
            "browRight" to clamp01(
                maxOf(
                    score(blendshapes, "browOuterUpRight"),
                    score(blendshapes, "browInnerUp"),
                ),
            ),
            "trackingConfidence" to 1.0,
        )

        emitState(token, filter.apply(state))
    }

    private fun emitState(token: Long, state: Map<String, Double>) {
        if (!isSessionActive(token)) return
        mainExecutor.execute {
            if (isSessionActive(token)) {
                onState(state)
            }
        }
    }

    private fun reportError(token: Long, code: String, message: String) {
        if (!isSessionActive(token)) return
        mainExecutor.execute {
            if (isSessionActive(token)) {
                onError(code, message)
            }
        }
    }

    private fun isSessionActive(token: Long): Boolean {
        return active && token == sessionId
    }

    private fun score(values: Map<String, Double>, key: String): Double {
        return values[key] ?: 0.0
    }

    private fun average(left: Double, right: Double): Double {
        return (left + right) / 2.0
    }

    private fun clamp01(value: Double): Double {
        return value.coerceIn(0.0, 1.0)
    }

    private fun clampUnit(value: Double): Double {
        return value.coerceIn(-1.0, 1.0)
    }

    private fun eulerDegrees(matrix: FloatArray): HeadPose {
        if (matrix.size < 16) return HeadPose(0.0, 0.0, 0.0)

        // MediaPipe returns a column-major 4x4 transformation matrix.
        val r00 = matrix[0].toDouble()
        val r10 = matrix[1].toDouble()
        val r20 = matrix[2].toDouble()
        val r21 = matrix[6].toDouble()
        val r22 = matrix[10].toDouble()

        val pitch = atan2(r21, r22)
        val yaw = atan2(-r20, sqrt((r21 * r21) + (r22 * r22)))
        val roll = atan2(r10, r00)

        return HeadPose(
            yaw = Math.toDegrees(yaw),
            pitch = Math.toDegrees(pitch),
            roll = Math.toDegrees(roll),
        )
    }

    private fun idleState(): Map<String, Double> = mapOf(
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
        "trackingConfidence" to 0.0,
    )

    private fun imageProxyIsClosed(imageProxy: ImageProxy): Boolean {
        return try {
            imageProxy.planes
            false
        } catch (_: IllegalStateException) {
            true
        }
    }

    private data class HeadPose(
        val yaw: Double,
        val pitch: Double,
        val roll: Double,
    )

    companion object {
        private const val MODEL_ASSET_NAME = "face_landmarker.task"
    }
}
