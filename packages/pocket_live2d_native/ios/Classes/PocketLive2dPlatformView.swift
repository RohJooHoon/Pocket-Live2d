import Flutter
import UIKit

final class PocketLive2dPlatformView: UIView, FlutterPlatformView {
    private var parameters: [String: Double] = [:]

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = UIColor(red: 235/255, green: 245/255, blue: 238/255, alpha: 1)
        isUserInteractionEnabled = false
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
    func view() -> UIView { self }

    func update(_ values: [String: Double]) {
        parameters = values
        setNeedsDisplay()
    }

    override func draw(_ rect: CGRect) {
        let x = bounds.midX + CGFloat(parameters["ParamEyeBallX"] ?? 0) * bounds.width * 0.3
        let y = bounds.midY - CGFloat(parameters["ParamEyeBallY"] ?? 0) * bounds.height * 0.3
        let color = UIColor(red: 78/255, green: 123/255, blue: 103/255, alpha: 1)
        color.setFill()
        UIBezierPath(ovalIn: CGRect(x: x - 18, y: y - 18, width: 36, height: 36)).fill()
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        ("Input preview · character pending" as NSString).draw(
            in: CGRect(x: 8, y: bounds.height * 0.85, width: bounds.width - 16, height: 40),
            withAttributes: [.font: UIFont.systemFont(ofSize: 14), .foregroundColor: color, .paragraphStyle: paragraph])
    }
}

final class PocketLive2dViewFactory: NSObject, FlutterPlatformViewFactory {
    // Flutter owns the view. The plugin never retains disposed platform views.
    let surfaces = NSHashTable<PocketLive2dPlatformView>.weakObjects()
    var parameters: [String: Double] = [:]

    func create(withFrame frame: CGRect, viewIdentifier viewId: Int64, arguments args: Any?) -> FlutterPlatformView {
        let surface = PocketLive2dPlatformView(frame: frame)
        surfaces.add(surface)
        surface.update(parameters)
        return surface
    }
    func createArgsCodec() -> FlutterMessageCodec & NSObjectProtocol { FlutterStandardMessageCodec.sharedInstance() }
    func update(_ values: [String: Double]) {
        parameters = values
        surfaces.allObjects.forEach { $0.update(values) }
    }
}
