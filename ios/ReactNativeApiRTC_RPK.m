//
//  ReactNativeApiRTC_RPK.m
//  reactNativeApiRTC
//
//  Created by Fred on 22/04/2024.
//

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import "React/RCTEventEmitter.h"

@interface RCT_EXTERN_MODULE(ReactNativeApiRTC_RPK, RCTEventEmitter)
RCT_EXTERN_METHOD(setBroadcastExtensionAsActive)
RCT_EXTERN_METHOD(setBroadcastExtensionAsInactive)
@end
