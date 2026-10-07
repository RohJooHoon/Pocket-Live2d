package com.rohjoohoon.pocket_live2d_native

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.View
import io.flutter.plugin.platform.PlatformView

/** Input diagnostic only. Replace with a Cubism renderer after SDK installation. */
internal class DiagnosticSurface(context: Context, private val onDispose: () -> Unit) : View(context), PlatformView {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var parameters: Map<String, Double> = emptyMap()

    fun update(values: Map<String, Double>) {
        parameters = values
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        canvas.drawColor(Color.rgb(235, 245, 238))
        val x = width / 2f + (parameters["ParamEyeBallX"] ?: 0.0).toFloat() * width * 0.3f
        val y = height / 2f - (parameters["ParamEyeBallY"] ?: 0.0).toFloat() * height * 0.3f
        paint.color = Color.rgb(78, 123, 103)
        canvas.drawCircle(x, y, 18 * resources.displayMetrics.density, paint)
        paint.textSize = 14 * resources.displayMetrics.scaledDensity
        paint.textAlign = Paint.Align.CENTER
        canvas.drawText("Input preview · character pending", width / 2f, height * 0.85f, paint)
    }

    override fun getView(): View = this
    override fun dispose() = onDispose()
}
