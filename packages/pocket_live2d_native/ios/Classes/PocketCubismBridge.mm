#import "PocketCubismBridge.h"
#import <GLKit/GLKit.h>
#import "Runtime/PocketCubismRuntime.hpp"
#include <stdexcept>

@interface PocketCubismSurface () <GLKViewDelegate>
@end
@implementation PocketCubismSurface {
    GLKView *_glView;
    EAGLContext *_context;
    CADisplayLink *_displayLink;
    std::unique_ptr<pocket::Runtime> _runtime;
    NSString* (^_resolver)(NSString*);
    void (^_status)(NSDictionary*);
    NSString *_modelId;
    BOOL _needsLoad;
    BOOL _loaded;
    double _lastFrame;
    int _width, _height;
}
+ (BOOL)sdkAvailable { return pocket::Runtime::available(); }
- (instancetype)initWithResolver:(NSString* (^)(NSString*))resolver status:(void (^)(NSDictionary*))status {
    self = [super init];
    if (!self) return nil;
    _resolver = [resolver copy]; _status = [status copy]; _modelId = @"mark";
    _context = [[EAGLContext alloc] initWithAPI:kEAGLRenderingAPIOpenGLES2];
    _glView = [[GLKView alloc] initWithFrame:CGRectZero context:_context];
    _glView.delegate = self;
    _glView.enableSetNeedsDisplay = NO;
    _glView.drawableColorFormat = GLKViewDrawableColorFormatRGBA8888;
    _glView.drawableDepthFormat = GLKViewDrawableDepthFormatNone;
    _needsLoad = YES;
    _displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(frame:)];
    _displayLink.preferredFramesPerSecond = 60;
    [_displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    return self;
}
- (UIView*)view { return _glView; }
- (void)emit:(NSString*)state message:(NSString*)message {
    NSMutableDictionary *data = [@{@"state": state, @"modelId": _modelId} mutableCopy];
    if (message) data[@"message"] = message;
    _status(data);
}
- (void)frame:(CADisplayLink*)link { if (_glView.window) [_glView display]; }
- (void)glkView:(GLKView*)view drawInRect:(CGRect)rect {
    [EAGLContext setCurrentContext:_context];
    int width = (int)view.drawableWidth, height = (int)view.drawableHeight;
    if (width <= 0 || height <= 0) return;
    glViewport(0,0,width,height);
    glClearColor(.92f,.96f,.94f,1);
    glClear(GL_COLOR_BUFFER_BIT);
    if (!pocket::Runtime::available()) {
        if (_needsLoad) { _needsLoad = NO; [self emit:@"sdk_unavailable" message:@"Cubism SDK/Core is not installed"]; }
        return;
    }
    try {
        if (!_runtime) _runtime.reset(new pocket::Runtime([](const std::string& path) {
            NSString* filename = [NSString stringWithUTF8String:path.c_str()];
            NSData* data = [NSData dataWithContentsOfFile:filename];
            if (!data) throw std::runtime_error("Missing model resource: " + path);
            const auto* bytes = static_cast<const unsigned char*>(data.bytes);
            return pocket::Bytes(bytes, bytes + data.length);
        }));
        if (_needsLoad) {
            _needsLoad = NO; [self emit:@"loading" message:nil];
            NSString* name = [_modelId stringByReplacingCharactersInRange:NSMakeRange(0,1)
                withString:[[_modelId substringToIndex:1] uppercaseString]];
            NSString* key = [NSString stringWithFormat:@"assets/live2d/%@/%@.model3.json", _modelId, name];
            NSString* path = _resolver(key);
            _runtime->load(path.UTF8String,width,height);
            _loaded = YES; [self emit:@"loaded" message:nil];
        } else if (_loaded && (width != _width || height != _height)) {
            _runtime->resize(width,height);
        }
        _width = width; _height = height;
        double now = CACurrentMediaTime();
        float dt = _lastFrame == 0 ? 1.f/60 : static_cast<float>(now-_lastFrame);
        _lastFrame = now;
        if (_loaded) _runtime->draw(dt);
    } catch(const std::exception& error) {
        _loaded = NO; [self emit:@"error" message:[NSString stringWithUTF8String:error.what()]];
    }
}
- (void)loadModel:(NSString*)modelId { _modelId = [modelId copy]; _needsLoad = YES; }
- (void)playMotion:(NSString*)group index:(NSInteger)index {
    if (!_runtime || !_loaded) { [self emit:@"error" message:@"Model is not ready"]; return; }
    [EAGLContext setCurrentContext:_context];
    try { _runtime->motion(group.UTF8String,(int)index); }
    catch(const std::exception& error) { [self emit:@"error" message:[NSString stringWithUTF8String:error.what()]]; }
}
- (void)setExpression:(NSString*)name {
    if (!_runtime || !_loaded) { [self emit:@"error" message:@"Model is not ready"]; return; }
    try { _runtime->expression(name.UTF8String); }
    catch(const std::exception& error) { [self emit:@"error" message:[NSString stringWithUTF8String:error.what()]]; }
}
- (void)lookAtX:(double)x y:(double)y active:(BOOL)active { if (_runtime) _runtime->look(x,y,active); }
- (void)tapAtX:(double)x y:(double)y {
    if (!_runtime || !_loaded) return;
    try { _runtime->tap(x,y); }
    catch(const std::exception& error) { [self emit:@"error" message:[NSString stringWithUTF8String:error.what()]]; }
}
- (void)orientationX:(double)x y:(double)y z:(double)z { if (_runtime) _runtime->orientation(x,y,z); }
- (void)face:(NSArray<NSNumber*>*)values {
    if (!_runtime || values.count != 12) return;
    std::array<float,12> data;
    for(NSUInteger i=0;i<12;++i) data[i]=values[i].floatValue;
    _runtime->face(data);
}
- (void)resetInput { if (_runtime) _runtime->reset(); }
- (void)setPaused:(BOOL)paused { _displayLink.paused = paused; _lastFrame=0; }
- (void)dispose {
    [_displayLink invalidate]; _displayLink=nil;
    [EAGLContext setCurrentContext:_context];
    _runtime.reset();
    [EAGLContext setCurrentContext:nil];
    _loaded=NO;
}
- (void)dealloc { [self dispose]; }
@end
