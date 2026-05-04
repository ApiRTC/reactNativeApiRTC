
# ReactNativeApiRTC

Demo for usage of apiRTC.js with React Native.

ApiRTC is full WebRTC API SDK provided by Apizee: https://apirtc.com/

This demo is also using react-native-webrtc: https://github.com/react-native-webrtc/react-native-webrtc

## Usage
- Make sure to have a react native development environment ready :
You can check documentation :
* [https://facebook.github.io/react-native/docs/getting-started](https://facebook.github.io/react-native/docs/getting-started)
* [https://reactnative.dev/docs/environment-setup](https://reactnative.dev/docs/environment-setup)
- Clone the repository.
- Run `npm install`.  

### iOS
- install Xcode and command line tools
- run `pod update` from ios folder (cd ios)
- run `npm run ios` or run project from Xcode workspace

### Android:
- run `npm run android` or run project from Android Studio
	
## ApiRTC key
For this demo we use the ApiKey "myDemoApiKey". Please register on our website to get [your own private ApiKey](https://cloud.apizee.com/register)

## Supported Features
Here is the list of supported feature depending on mobile OS

| Feature | Android | iOS |
| :---         |     :---:      |     :---:      |
| Audio / video conf   | :white_check_mark: | :white_check_mark: |
| Mute audio   | :white_check_mark: | :white_check_mark: |
| Mute video   | :white_check_mark: | :white_check_mark: |
| Switch camera   | :white_check_mark: | :white_check_mark: |
| Media routing : SFU   | :white_check_mark: | :white_check_mark: |
| Media routing : Mesh  | :white_check_mark: | :white_check_mark: |
| Chat     | :white_check_mark: | :white_check_mark: |
| Record     | :white_check_mark: | :white_check_mark: |
| Screensharing   | :white_check_mark: | :white_check_mark: |
| Background blur | :white_check_mark: | :x: |

Option in application sample :
- Drag & drop video local (check comment with DRAG_AND_DROP in code)

## Compatibility
- This demo is compatible with iOS 12+ & Android 10+
- ScreenSharing on iOS needs iOS 14+

## Demo Usage

Start application on your mobile, and connect to a room.
Then you can open [apiRTC Conference demo](https://apirtc.github.io/ApiRTC-examples/conferencing/index.html) in the browser of your computer, and connect to the same room.

## FAQ

### Requirements
* React Native needs Node.js >= 16 (Check [NVM](https://github.com/nvm-sh/nvm) if needed)

### Restrictions
* iOS screenSharing : screenSharing stream cannot be displayed locally on the application on iOS

### What are the authorizations that are needed to be declared on application

For Android, edit your AndroidManifest.xml file by adding :
```
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <!-- Screen sharing -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
```

For iOS, edit your Info.plist file by adding :
```
	<key>NSCameraUsageDescription</key>
	<string>Camera permission description</string>
	<key>NSMicrophoneUsageDescription</key>
	<string>Microphone permission description</string>

	<key>RTCScreenSharingExtension</key>
	<string>org.reactjs.native.example.reactNativeApiRTC.screenSharing-Extension</string>
	<key>UIBackgroundModes</key>
	<array>
		<string>audio</string>
		<string>fetch</string>
		<string>processing</string>
		<string>remote-notification</string>
		<string>voip</string>
	</array>
```

### Android SDK

Make sure that you have set ANDROID_HOME value

Sample for mac :
nano ~/.bash_profile
add following lines in bash_profile file:

    export ANDROID_HOME=/Users/YOUR_USER/Library/Android/sdk/  //Path to your Android SDK

    export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

source ~/.bash_profile //To apply modifications

echo $ANDROID_HOME //To check modifications

### Android Screensharing

Android screenSharing service need to be enabled.
You have to add the following code very early in your application, in your main activity's onCreate for instance:
```
    // Initialize the WebRTC module options.
    WebRTCModuleOptions options = WebRTCModuleOptions.getInstance();
    options.enableMediaProjectionService = true;
```

At the begining of your MainApplication.java file, import the module with :
```
    import com.oney.WebRTCModule.WebRTCModuleOptions;
```

### iOS Screensharing

Our application includes the possibility to share screen on iOS.
Several steps are needed to add this feature on your application : 
Here is [the documentation](Docs/add_screenSharing_on_iOS.md) to help you in this task.

### Which node version was used for tutorial testings

NodeJs version 20.5.1 . (Check [NVM](https://github.com/nvm-sh/nvm) if you need to have several nodeJs version)


### Manage application kill by user

A native module AppLifecycleModule is added in our application to manage the case where the user kill the application using swipe.
This module detect the onHostDestroy event to stop the screenSharing extension and unpublish stream.

---

## Adding Background Blur (Android only)

Background blur uses ML Kit Selfie Segmentation + RenderScript to separate the person from the background and apply a Gaussian blur. The blur is applied at the WebRTC VideoSource level, so **both the local preview and remote peers see the blurred video**.

> **Platform support:** Android only. The feature is automatically hidden on iOS.

### Architecture overview

```
Camera → VideoSource → [BlurVideoProcessor] → VideoTrack → RTCView + WebRTC encoder
                           ↑
                    ML Kit segmentation
                    RenderScript Gaussian blur
                    Canvas compositing
```

### Step 1 — Copy the native Kotlin files

Copy the following 3 files into your Android app's Java/Kotlin source directory (same directory as `MainApplication.java`):

| File to copy | Source in this repo | Destination (adapt to your package) |
|---|---|---|
| `BackgroundBlurModule.kt` | `android/app/src/main/java/com/reactnativeapirtc/` | `android/app/src/main/java/<your/package>/` |
| `BlurVideoProcessor.kt` | `android/app/src/main/java/com/reactnativeapirtc/` | `android/app/src/main/java/<your/package>/` |
| `BackgroundBlurPackage.kt` | `android/app/src/main/java/com/reactnativeapirtc/` | `android/app/src/main/java/<your/package>/` |

If your app uses a different package name, update the first line of each file:
```kotlin
package com.reactnativeapirtc  // ← replace with your package name
```

### Step 2 — Copy the SVG icon components

Copy the 2 icon files into your assets/svg directory (or wherever you keep SVG icon components):

```
assets/svg/Blur_on.js
assets/svg/Blur_off.js
```

### Step 3 — Update `android/app/build.gradle`

In the `defaultConfig` block, add RenderScript support:
```gradle
defaultConfig {
    // ... your existing config ...
    renderscriptTargetApi 21
    renderscriptSupportModeEnabled true
}
```

In the `dependencies` block, add the ML Kit dependency:
```gradle
dependencies {
    // ... your existing dependencies ...
    implementation("com.google.mlkit:segmentation-selfie:16.0.0-beta6")
}
```

### Step 4 — Register the package in `MainApplication.java`

In the `getPackages()` method of your `MainApplication.java`, add:
```java
packages.add(new BackgroundBlurPackage());
```

Full example:
```java
@Override
protected List<ReactPackage> getPackages() {
    List<ReactPackage> packages = new PackageList(this).getPackages();
    packages.add(new AppLifecyclePackage());
    packages.add(new BackgroundBlurPackage()); // ← add this line
    return packages;
}
```

### Step 5 — JavaScript integration

In your component, import the native module and the icon components:
```javascript
import { NativeModules, Platform } from 'react-native';
const { BackgroundBlurModule } = NativeModules;

import Blur_on from './assets/svg/Blur_on.js';
import Blur_off from './assets/svg/Blur_off.js';
```

Add `blur: false` to your component state:
```javascript
const initialState = {
  // ...
  blur: false,
};
```

Add the `toggleBlur` method:
```javascript
toggleBlur = async () => {
  if (Platform.OS !== 'android') return;
  if (!this.localStream) return;

  try {
    if (this.state.blur === false) {
      const videoTrack = this.localStream.data._tracks.find(t => t.kind === 'video');
      if (!videoTrack) return;
      await BackgroundBlurModule.enableBlur({
        streamReactTag: this.localStream.data._reactTag,
        trackId: videoTrack.id,
      });
      this.setState({ blur: true });
    } else {
      await BackgroundBlurModule.disableBlur();
      this.setState({ blur: false });
    }
  } catch (err) {
    console.error('Error toggling blur:', err);
  }
};
```

Disable blur when leaving the call (in your `hangUp` method):
```javascript
hangUp = () => {
  if (this.state.blur && Platform.OS === 'android') {
    try { BackgroundBlurModule.disableBlur(); } catch (e) {}
    this.setState({ blur: false });
  }
  // ... rest of hangUp logic
};
```

Add the blur button to your UI (Android only):
```jsx
{Platform.OS === 'android' && (
  <TouchableOpacity onPress={() => this.toggleBlur()}>
    {this.state.blur ? <Blur_on /> : <Blur_off />}
  </TouchableOpacity>
)}
```

### Notes & requirements

- **Minimum Android API:** 21 (Android 5.0) — required for RenderScript
- **Google Play Services:** The ML Kit selfie segmentation model is downloaded on first use. An internet connection is required the first time.
- **Performance:** Segmentation runs on every 5th frame (configurable via `SEGMENTATION_INTERVAL` in `BlurVideoProcessor.kt`). The blur applies to all frames using the cached mask. This balances quality vs. CPU usage.
