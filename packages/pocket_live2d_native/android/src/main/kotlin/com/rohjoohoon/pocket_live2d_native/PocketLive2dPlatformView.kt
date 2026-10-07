package com.rohjoohoon.pocket_live2d_native

import android.content.Context
import android.graphics.Color
import android.view.View
import android.widget.FrameLayout
import io.flutter.plugin.platform.PlatformView

internal class PocketLive2dPlatformView(
    context: Context,
    private val creationParams: Map<String, Any?>,
) : PlatformView {
    private val rootView = FrameLayout(context).apply {
        setBackgroundColor(resolveBackgroundColor(creationParams["backgroundColor"]))
    }

    val modelId: String?
        get() = creationParams["modelId"] as? String

    override fun getView(): View = rootView

    override fun dispose() {
        rootView.removeAllViews()
        // TODO: Release EGL/Cubism renderer resources owned by this view.
    }

    private fun resolveBackgroundColor(rawColor: Any?): Int {
        return (rawColor as? Number)?.toInt() ?: Color.TRANSPARENT
    }
}
