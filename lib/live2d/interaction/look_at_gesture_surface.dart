import 'dart:async';

import 'package:flutter/material.dart';

import '../live2d_controller.dart';

abstract final class LookAtCoordinates {
  static Offset normalize(Offset localPosition, Size size) {
    if (size.width <= 0 || size.height <= 0) {
      return Offset.zero;
    }

    final x = ((localPosition.dx / size.width) * 2) - 1;
    final y = 1 - ((localPosition.dy / size.height) * 2);

    return Offset(
      x.clamp(-1.0, 1.0).toDouble(),
      y.clamp(-1.0, 1.0).toDouble(),
    );
  }
}

class LookAtGestureSurface extends StatefulWidget {
  const LookAtGestureSurface({
    super.key,
    required this.controller,
    required this.child,
    this.enabled = true,
    this.minInterval = const Duration(milliseconds: 33),
    this.resetOnEnd = true,
  });

  final Live2DController controller;
  final Widget child;
  final bool enabled;
  final Duration minInterval;
  final bool resetOnEnd;

  @override
  State<LookAtGestureSurface> createState() => _LookAtGestureSurfaceState();
}

class _LookAtGestureSurfaceState extends State<LookAtGestureSurface> {
  final Stopwatch _stopwatch = Stopwatch()..start();

  Timer? _pendingTimer;
  Offset? _pendingTarget;
  Duration? _lastSentAt;
  int? _activePointer;
  bool _disposed = false;

  @override
  void didUpdateWidget(covariant LookAtGestureSurface oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.enabled && !widget.enabled) {
      _activePointer = null;
      _cancelPending();
      _send(Offset.zero, force: true);
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _activePointer = null;
    _cancelPending();
    _stopwatch.stop();
    super.dispose();
  }

  void _handlePointerDown(PointerDownEvent event) {
    if (!widget.enabled || _activePointer != null) return;
    _activePointer = event.pointer;
    _handlePosition(event.localPosition);
  }

  void _handlePointerMove(PointerMoveEvent event) {
    if (!widget.enabled || event.pointer != _activePointer) return;
    _handlePosition(event.localPosition);
  }

  void _handlePointerEnd(PointerEvent event) {
    if (event.pointer != _activePointer) return;
    _activePointer = null;
    _cancelPending();
    if (widget.enabled && widget.resetOnEnd) {
      _send(Offset.zero, force: true);
    }
  }

  void _handlePosition(Offset localPosition) {
    if (!widget.enabled) return;

    final renderObject = context.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.hasSize) return;

    final target = LookAtCoordinates.normalize(localPosition, renderObject.size);
    _schedule(target);
  }

  void _schedule(Offset target) {
    final now = _stopwatch.elapsed;
    final lastSentAt = _lastSentAt;

    if (lastSentAt == null || now - lastSentAt >= widget.minInterval) {
      _send(target);
      return;
    }

    _pendingTarget = target;
    if (_pendingTimer != null) return;

    final remaining = widget.minInterval - (now - lastSentAt);
    _pendingTimer = Timer(remaining, () {
      _pendingTimer = null;
      final pendingTarget = _pendingTarget;
      _pendingTarget = null;
      if (pendingTarget != null && widget.enabled && !_disposed) {
        _send(pendingTarget);
      }
    });
  }

  void _send(Offset target, {bool force = false}) {
    if (_disposed) return;

    if (force) {
      _cancelPending();
    }

    _lastSentAt = _stopwatch.elapsed;
    unawaited(
      widget.controller.lookAt(target.dx, target.dy).catchError((_) {}),
    );
  }

  void _cancelPending() {
    _pendingTimer?.cancel();
    _pendingTimer = null;
    _pendingTarget = null;
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: widget.enabled ? _handlePointerDown : null,
      onPointerMove: widget.enabled ? _handlePointerMove : null,
      onPointerUp: widget.enabled ? _handlePointerEnd : null,
      onPointerCancel: widget.enabled ? _handlePointerEnd : null,
      child: widget.child,
    );
  }
}
