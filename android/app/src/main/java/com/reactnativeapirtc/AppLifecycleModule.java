package com.reactnativeapirtc;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.LifecycleEventListener;

import com.oney.WebRTCModule.WebRTCModule;

import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Arguments;

import android.util.Log;

import java.util.Map;
import java.util.HashMap;

public class AppLifecycleModule extends ReactContextBaseJavaModule implements LifecycleEventListener {

    private final ReactApplicationContext reactContext;
    private String localStreamReactTag = null; // Variable to store the reactTag value
    private String localStreamTrackId = null; // Variable to store the trackId value
    // Variables to store the screen sharing reactTag and trackId
    private String localScreenReactTag = null; // Variable to store the reactTag value
    private String localScreenTrackId = null; // Variable to store the trackId value

    AppLifecycleModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;

        // Add the listener for `lifecycleEvents`
        reactContext.addLifecycleEventListener(this);
    }

    @Override
    public String getName() {
        return "AppLifecycleModule";
    }

    @Override
    public void onHostResume() {
        Log.d("AppLifecycleModule", "Activity onResume");
    }

    @Override
    public void onHostPause() {
        Log.d("AppLifecycleModule", "Activity onPause");
    }

    @Override
    public void onHostDestroy() {
        Log.d("AppLifecycleModule", "Activity onDestroy");
        WritableMap params = Arguments.createMap();
        params.putString("eventType", "onDestroy");

        // Send the event to the application level
        sendEventToApplicationLevel(reactContext, "liveCycleEvent", params);

        //get acces to WebRTCModule
        WebRTCModule mWebRTCModule = reactContext.getNativeModule(WebRTCModule.class);

        if (mWebRTCModule != null && this.localStreamReactTag != null) {
            Log.d("AppLifecycleModule", "mWebRTCModule.mediaStreamRelease called with localStreamReactTag: " + this.localStreamReactTag);
            mWebRTCModule.mediaStreamRelease(this.localStreamReactTag);
        } else {
            Log.d("AppLifecycleModule", "WebRTCModule or this.localStreamReactTag is null");
        }

        if (mWebRTCModule != null && this.localScreenTrackId != null) {
            Log.d("AppLifecycleModule", "mWebRTCModule.mediaStreamTrackRelease called with localScreenTrackId: " + this.localScreenTrackId);
            mWebRTCModule.mediaStreamTrackRelease(this.localScreenTrackId);
            //Using mediaStreamTrackRelease enbale to stop the screen sharing extension
        } else {
            Log.d("AppLifecycleModule", "WebRTCModule or this.localScreenTrackId is null");
        }
    }

    @ReactMethod
    public void sendInfoToAppLifecycleModule(ReadableMap params) {
        Log.d("AppLifecycleModule", "sendInfoToAppLifecycleModule called with params: " + params);

        // Handle the incoming params
        String localStreamReactTagParam = params.getString("localStreamReactTag");
        String localStreamTrackIdParam = params.getString("localStreamTrackId");
        String localScreenReactTagParam = params.getString("localScreenReactTag");
        String localScreenTrackIdParam = params.getString("localScreenTrackId");

        if (localStreamReactTagParam != null) {
            Log.d("AppLifecycleModule", "localStreamReactTag is not null: " + localStreamReactTagParam);
            if (localStreamReactTagParam.equals("STOPPED")) {
                this.localStreamReactTag = null; // Reset if "STOPPED"
            } else {
                this.localStreamReactTag = localStreamReactTagParam;
            }
            Log.d("AppLifecycleModule", "localStreamReactTag set to: " + this.localStreamReactTag);
        } else {
            Log.d("AppLifecycleModule", "localStreamReactTag is not modified");
        }

        if (localStreamTrackIdParam != null) {
            Log.d("AppLifecycleModule", "localStreamTrackId is not null: " + localStreamTrackIdParam);
            if (localStreamTrackIdParam.equals("STOPPED")) {
                this.localStreamTrackId = null; // Reset if "STOPPED"
            } else {
                this.localStreamTrackId = localStreamTrackIdParam;
            }
            Log.d("AppLifecycleModule", "localStreamTrackId set to: " + this.localStreamTrackId);
        } else {
            Log.d("AppLifecycleModule", "localStreamTrackId is not modified");
        }

        if (localScreenReactTagParam != null) {
            Log.d("AppLifecycleModule", "localScreenReactTag is not null: " + localScreenReactTagParam);
            if (localScreenReactTagParam.equals("STOPPED")) {
                this.localScreenReactTag = null; // Reset if "STOPPED"
            } else {
                this.localScreenReactTag = localScreenReactTagParam;
            }
            Log.d("AppLifecycleModule", "localScreenReactTag set to: " + this.localScreenReactTag);
        } else {
            Log.d("AppLifecycleModule", "localScreenReactTag is not modified");
        }

        if (localScreenTrackIdParam != null) {
            Log.d("AppLifecycleModule", "localScreenTrackId is not null: " + localScreenTrackIdParam);
            if (localScreenTrackIdParam.equals("STOPPED")) {
                this.localScreenTrackId = null; // Reset if "STOPPED"
            } else {
                this.localScreenTrackId = localScreenTrackIdParam;
            }
            Log.d("AppLifecycleModule", "localScreenTrackId set to: " + this.localScreenTrackId);
        } else {
            Log.d("AppLifecycleModule", "localScreenTrackId is not modified");
        }
    }

    private void sendEventToApplicationLevel(ReactContext reactContext, String eventName, WritableMap params) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, params);
    }
}
