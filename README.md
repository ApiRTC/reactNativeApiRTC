
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
