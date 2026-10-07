#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
@interface PocketCubismSurface : NSObject
@property(class, nonatomic, readonly) BOOL sdkAvailable;
@property(nonatomic, readonly) UIView *view;
- (instancetype)initWithResolver:(NSString* (^)(NSString*))resolver status:(void (^)(NSDictionary*))status NS_SWIFT_NAME(init(resolve:status:));
- (void)loadModel:(NSString*)modelId NS_SWIFT_NAME(load(modelId:));
- (void)playMotion:(NSString*)group index:(NSInteger)index NS_SWIFT_NAME(play(group:index:));
- (void)setExpression:(NSString*)name NS_SWIFT_NAME(set(expression:));
- (void)lookAtX:(double)x y:(double)y active:(BOOL)active NS_SWIFT_NAME(look(x:y:active:));
- (void)tapAtX:(double)x y:(double)y NS_SWIFT_NAME(tap(x:y:));
- (void)orientationX:(double)x y:(double)y z:(double)z NS_SWIFT_NAME(orientation(x:y:z:));
- (void)face:(NSArray<NSNumber*>*)values;
- (void)resetInput;
- (void)setPaused:(BOOL)paused;
- (void)dispose;
@end
NS_ASSUME_NONNULL_END
