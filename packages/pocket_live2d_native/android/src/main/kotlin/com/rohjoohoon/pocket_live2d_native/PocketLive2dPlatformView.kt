package com.rohjoohoon.pocket_live2d_native

import android.content.Context
import android.graphics.Color
import android.view.View
import android.widget.FrameLayout
import io.flutter.plugin.platform.PlatformView

internal class PocketLive2dPlatformView(
    context: Context,
    creationParams: Map<String, Any?>,
    private val renderer: PocketLive2dCubismRenderer,
) : PlatformView {
    private val root = FrameLayout(context).apply {
        setBackgroundColor((creationParams["backgroundColor"] as? Number)?.toInt() ?: Color.TRANSPARENT)
        addView(renderer.attach(), FrameLayout.LayoutParams(-1, -1))
    }
    init { (creationParams["modelId"] as? String)?.let(renderer::loadModel) }
    override fun getView(): View = root
    override fun dispose() { renderer.detach(); root.removeAllViews() }
}
