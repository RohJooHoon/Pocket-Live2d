package com.rohjoohoon.pocket_live2d_native

import android.content.res.AssetManager

internal object PocketCubismJni {
    init { System.loadLibrary("pocket_live2d") }
    external fun available(): Boolean
    external fun create(assets: AssetManager): Long
    external fun destroy(handle: Long)
    external fun load(handle: Long, manifest: String, width: Int, height: Int)
    external fun resize(handle: Long, width: Int, height: Int)
    external fun draw(handle: Long, seconds: Float)
    external fun motion(handle: Long, group: String, index: Int)
    external fun expression(handle: Long, name: String)
    external fun tap(handle: Long, x: Float, y: Float)
    external fun orientation(handle: Long, x: Float, y: Float, z: Float)
    external fun face(handle: Long, values: FloatArray)
    external fun look(handle: Long, x: Float, y: Float, active: Boolean)
    external fun reset(handle: Long)
}
