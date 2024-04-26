import {NativeModules, NativeEventEmitter, Platform} from 'react-native';

class ReactNativeApiRTC_RPK extends NativeEventEmitter {
  constructor(nativeModule) {
    super(nativeModule);

    this.setBroadcastExtensionAsActive =
      Platform.OS === 'ios' ? nativeModule.setBroadcastExtensionAsActive : null;

    this.setBroadcastExtensionAsInactive =
      Platform.OS === 'ios'
        ? nativeModule.setBroadcastExtensionAsInactive
        : null;
  }
}

export default new ReactNativeApiRTC_RPK(NativeModules.ReactNativeApiRTC_RPK);
