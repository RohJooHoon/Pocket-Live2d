package com.rohjoohoon.pocket_live2d_native

import android.content.Context
import android.graphics.Color
import android.view.View
import android.widget.FrameLayout
import io.flutter.plugin.platform.PlatformView

internal class PocketLive2dPlatformView(
    context: Context,
    private val creationParams: Map<String, Any?>,
    private val renderer: PocketLive2dRenderer,
) : PlatformView {
    private val rootView = FrameLayout(context).apply {
        setBackgroundColor(resolveBackgroundColor(creationParams["backgroundColor"]))
    }

    init {
        modelId?.let(renderer::loadModel)
    }

    val modelId: String?
        get() = creationParams["modelId"] as? String

    override fun getView(): View = rootView

    override fun dispose() {
        rootView.removeAllViews()
        // The renderer is plugin-scoped. Surface-specific cleanup will be added
        // when the Cubism renderer owns an EGL surface for this PlatformView.
    }

    private fun resolveBackgroundColor(rawColor: Any?): Int {
        return (rawColor as? Number)?.toInt() ?: Color.TRANSPARENT
    }
}
