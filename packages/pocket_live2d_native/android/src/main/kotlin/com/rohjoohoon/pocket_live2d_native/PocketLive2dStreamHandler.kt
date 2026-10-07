package com.rohjoohoon.pocket_live2d_native

import io.flutter.plugin.common.EventChannel

internal class PocketLive2dStreamHandler : EventChannel.StreamHandler {
    private var eventSink: EventChannel.EventSink? = null

    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        eventSink = events
    }

    override fun onCancel(arguments: Any?) {
        eventSink = null
    }

    fun emit(event: Map<String, Any>) {
        eventSink?.success(event)
    }

    fun emitError(code: String, message: String, details: Any? = null) {
        eventSink?.error(code, message, details)
    }

    fun clear() {
        eventSink = null
    }
}
