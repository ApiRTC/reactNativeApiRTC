package com.reactnativeapirtc

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.oney.WebRTCModule.WebRTCModule
import org.webrtc.VideoSource

/**
 * React Native module that provides background blur functionality for Android.
 *
 * Architecture:
 *   This module finds the WebRTC VideoSource (camera source) via reflection
 *   and sets a VideoProcessor on it. The VideoProcessor intercepts every
 *   camera frame, applies ML Kit segmentation + RenderScript blur, and
 *   forwards the processed frame to the downstream pipeline.
 *
 *   Camera → VideoSource → [VideoProcessor] → VideoTrack → RTCView + Encoder
 *
 * This ensures both local preview AND remote peers see the blurred video.
 *
 * Exposed methods to JavaScript:
 *   - enableBlur(config): Promise
 *   - disableBlur(): Promise
 *   - isBlurEnabled(): Promise<boolean>
 */
class BackgroundBlurModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "BackgroundBlurModule"
        const val NAME = "BackgroundBlurModule"
    }

    private var processor: BlurVideoProcessor? = null
    private var imageProcessor: BackgroundImageProcessor? = null
    private var videoSource: VideoSource? = null

    override fun getName(): String = NAME

    /**
     * Enable background blur on the local video stream.
     */
    @ReactMethod
    fun enableBlur(config: ReadableMap, promise: Promise) {
        try {
            val trackId = readConfigString(config, "trackId")
            Log.d(TAG, "enableBlur called, trackId=$trackId")

            if (trackId.isEmpty()) {
                Log.e(TAG, "enableBlur rejected: trackId is empty — check that a video track is passed from JS")
                promise.reject("INVALID_ARGS", "trackId is required")
                return
            }

            val webRTCModule = reactApplicationContext
                .getNativeModule(WebRTCModule::class.java)
            if (webRTCModule == null) {
                Log.e(TAG, "enableBlur rejected: WebRTCModule not found in ReactContext")
                promise.reject("NO_WEBRTC", "WebRTCModule not found")
                return
            }

            val source = findVideoSource(webRTCModule, trackId)
            if (source == null) {
                Log.e(TAG, "enableBlur rejected: VideoSource not found for trackId=$trackId")
                promise.reject("NO_SOURCE", "VideoSource not found. Cannot attach blur processor.")
                return
            }

            Log.d(TAG, "VideoSource found: $source")

            if (processor != null) {
                Log.d(TAG, "Replacing existing blur processor")
                processor?.disable()
            }

            val strong = try { config.getBoolean("strong") } catch (_: Exception) { false }
            val proc = BlurVideoProcessor(
                reactApplicationContext,
                blurRadius = if (strong) 25f else 20f,
                blurPasses = if (strong) 3 else 1,
            )
            proc.enable()
            try {
                source.setVideoProcessor(proc)
            } catch (e: Exception) {
                Log.e(TAG, "setVideoProcessor failed — VideoSource may be disposed", e)
                proc.disable()
                promise.reject("SOURCE_ERROR", "Failed to attach processor to VideoSource: ${e.message}", e)
                return
            }

            processor = proc
            videoSource = source

            Log.d(TAG, "Background blur enabled successfully")
            promise.resolve(true)

        } catch (e: Exception) {
            Log.e(TAG, "Error enabling blur", e)
            promise.reject("BLUR_ERROR", "Failed to enable blur: ${e.message}", e)
        }
    }

    /**
     * Disable background blur and restore normal video processing.
     */
    @ReactMethod
    fun disableBlur(promise: Promise) {
        try {
            Log.d(TAG, "disableBlur called")

            videoSource?.setVideoProcessor(null)
            processor?.disable()
            processor = null
            imageProcessor?.disable()
            imageProcessor = null
            videoSource = null

            Log.d(TAG, "Video effect disabled successfully")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error disabling video effect", e)
            promise.reject("BLUR_ERROR", "Failed to disable effect: ${e.message}", e)
        }
    }

    /**
     * Enable background image replacement on the local video stream.
     * Downloads the image from imageUrl synchronously on the native modules thread.
     */
    @ReactMethod
    fun enableBackgroundImage(config: ReadableMap, promise: Promise) {
        try {
            val trackId = readConfigString(config, "trackId")
            val imageUrl = readConfigString(config, "imageUrl")
            Log.d(TAG, "enableBackgroundImage called, trackId=$trackId")

            if (trackId.isEmpty()) {
                promise.reject("INVALID_ARGS", "trackId is required")
                return
            }
            if (imageUrl.isEmpty()) {
                promise.reject("INVALID_ARGS", "imageUrl is required")
                return
            }

            val webRTCModule = reactApplicationContext.getNativeModule(WebRTCModule::class.java)
            if (webRTCModule == null) {
                promise.reject("NO_WEBRTC", "WebRTCModule not found")
                return
            }

            val source = findVideoSource(webRTCModule, trackId)
            if (source == null) {
                promise.reject("NO_SOURCE", "VideoSource not found for trackId=$trackId")
                return
            }

            val bitmap = downloadBitmap(imageUrl)
            if (bitmap == null) {
                promise.reject("DOWNLOAD_ERROR", "Failed to download image from $imageUrl")
                return
            }

            // Disable any active effect first
            videoSource?.setVideoProcessor(null)
            processor?.disable()
            processor = null
            imageProcessor?.disable()
            imageProcessor = null

            val proc = BackgroundImageProcessor(bitmap)
            proc.enable()
            try {
                source.setVideoProcessor(proc)
            } catch (e: Exception) {
                proc.disable()
                promise.reject("SOURCE_ERROR", "Failed to attach processor: ${e.message}", e)
                return
            }

            imageProcessor = proc
            videoSource = source

            Log.d(TAG, "Background image enabled successfully")
            promise.resolve(true)

        } catch (e: Exception) {
            Log.e(TAG, "Error enabling background image", e)
            promise.reject("IMAGE_BG_ERROR", "Failed to enable background image: ${e.message}", e)
        }
    }

    /**
     * Check if any video effect (blur or background image) is currently active.
     */
    @ReactMethod
    fun isBlurEnabled(promise: Promise) {
        promise.resolve(processor != null || imageProcessor != null)
    }

    /**
     * Download a Bitmap from a URL synchronously (safe on the native modules background thread).
     */
    private fun downloadBitmap(url: String): android.graphics.Bitmap? {
        return try {
            Log.d(TAG, "Downloading background image: $url")
            val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.doInput = true
            connection.connect()
            val bitmap = android.graphics.BitmapFactory.decodeStream(connection.inputStream)
            connection.disconnect()
            Log.d(TAG, "Downloaded: ${bitmap?.width}x${bitmap?.height}")
            bitmap
        } catch (e: Exception) {
            Log.e(TAG, "Failed to download image from $url", e)
            null
        }
    }

    // =====================================================================
    // Reflection helpers to find VideoSource in WebRTCModule
    // =====================================================================

    private fun readConfigString(config: ReadableMap, key: String): String {
        return try {
            config.getString(key) ?: ""
        } catch (_: Exception) {
            try {
                config.getDouble(key).toInt().toString()
            } catch (_: Exception) {
                ""
            }
        }
    }

    /**
     * Find the VideoSource associated with the local camera track.
     *
     * Strategy:
     * 1. WebRTCModule → getUserMediaImpl → tracks map → TrackPrivate.mediaSource
     * 2. Deep reflection search for any VideoSource instance
     */
    private fun findVideoSource(module: WebRTCModule, trackId: String): VideoSource? {
        Log.d(TAG, "Searching for VideoSource, trackId=$trackId")

        val gumiFieldNames = listOf("getUserMediaImpl", "mGetUserMediaImpl", "gumi", "getUserMedia")
        for (gumiName in gumiFieldNames) {
            try {
                val gumiField = module.javaClass.getDeclaredField(gumiName)
                gumiField.isAccessible = true
                val gumi = gumiField.get(module) ?: continue
                Log.d(TAG, "Found getUserMediaImpl via field '$gumiName': ${gumi.javaClass.name}")

                val source = findVideoSourceInGetUserMediaImpl(gumi, trackId)
                if (source != null) return source
            } catch (_: NoSuchFieldException) {
            } catch (e: Exception) {
                Log.d(TAG, "Error accessing $gumiName: ${e.message}")
            }
        }

        Log.d(TAG, "Falling back to deep reflection search from WebRTCModule")
        val source = deepFindVideoSource(module, 4)
        if (source != null) {
            Log.d(TAG, "Found VideoSource via deep search")
            return source
        }

        Log.e(TAG, "Could not find VideoSource through any strategy")
        logFieldNames(module, "WebRTCModule")
        return null
    }

    private fun findVideoSourceInGetUserMediaImpl(gumi: Any, trackId: String): VideoSource? {
        val captFieldNames = listOf("tracks", "mVideoCapturers", "videoCapturers", "capturers", "mCapturers")
        for (captName in captFieldNames) {
            try {
                val captField = gumi.javaClass.getDeclaredField(captName)
                captField.isAccessible = true
                val capturers = captField.get(gumi)

                if (capturers is Map<*, *>) {
                    Log.d(TAG, "Found capturers map '$captName' with ${capturers.size} entries, keys: ${capturers.keys}")

                    val exactMatch = capturers[trackId]
                    if (exactMatch == null) {
                        Log.w(TAG, "trackId='$trackId' not found in '$captName' map, falling back to first entry")
                    }
                    val controller = exactMatch ?: capturers.values.firstOrNull()
                    if (controller != null) {
                        val source = findVideoSourceInController(controller)
                        if (source != null) {
                            Log.d(TAG, "Found VideoSource in controller from '$captName'")
                            return source
                        }
                    }
                }
            } catch (_: NoSuchFieldException) {
            } catch (e: Exception) {
                Log.d(TAG, "Error accessing $captName: ${e.message}")
            }
        }

        return deepFindVideoSource(gumi, 3)
    }

    private fun findVideoSourceInController(controller: Any): VideoSource? {
        val srcFieldNames = listOf("mediaSource", "videoSource", "mVideoSource", "source", "mSource")
        for (srcName in srcFieldNames) {
            try {
                val srcField = controller.javaClass.getDeclaredField(srcName)
                srcField.isAccessible = true
                val src = srcField.get(controller)
                if (src is VideoSource) {
                    return src
                }
            } catch (_: NoSuchFieldException) {
            } catch (e: Exception) {
                Log.d(TAG, "Error accessing $srcName in controller: ${e.message}")
            }
        }

        return findFieldOfType(controller, VideoSource::class.java)
    }

    private fun <T> findFieldOfType(obj: Any, type: Class<T>): T? {
        var clazz: Class<*>? = obj.javaClass
        while (clazz != null && clazz != Any::class.java) {
            for (field in clazz.declaredFields) {
                try {
                    field.isAccessible = true
                    val value = field.get(obj)
                    if (type.isInstance(value)) {
                        @Suppress("UNCHECKED_CAST")
                        return value as T
                    }
                } catch (_: Exception) {}
            }
            clazz = clazz.superclass
        }
        return null
    }

    private fun deepFindVideoSource(root: Any, maxDepth: Int, visited: MutableSet<Int> = mutableSetOf()): VideoSource? {
        if (maxDepth <= 0) return null
        val id = System.identityHashCode(root)
        if (!visited.add(id)) return null

        var clazz: Class<*>? = root.javaClass
        while (clazz != null && clazz != Any::class.java) {
            for (field in clazz.declaredFields) {
                try {
                    field.isAccessible = true
                    val value = field.get(root) ?: continue

                    if (value is VideoSource) {
                        Log.d(TAG, "deepFind: found VideoSource in ${root.javaClass.simpleName}.${field.name}")
                        return value
                    }

                    if (value is Map<*, *>) {
                        for (entry in value.values) {
                            if (entry == null) continue
                            if (entry is VideoSource) return entry
                            val found = deepFindVideoSource(entry, maxDepth - 1, visited)
                            if (found != null) return found
                        }
                    }

                    if (value is Collection<*>) {
                        for (item in value) {
                            if (item == null) continue
                            if (item is VideoSource) return item
                            val found = deepFindVideoSource(item, maxDepth - 1, visited)
                            if (found != null) return found
                        }
                    }

                    val pkg = value.javaClass.name
                    if (pkg.startsWith("com.oney") || pkg.startsWith("org.webrtc")) {
                        val found = deepFindVideoSource(value, maxDepth - 1, visited)
                        if (found != null) return found
                    }
                } catch (_: Exception) {}
            }
            clazz = clazz.superclass
        }
        return null
    }

    private fun logFieldNames(obj: Any, label: String) {
        var clazz: Class<*>? = obj.javaClass
        val fields = mutableListOf<String>()
        while (clazz != null && clazz != Any::class.java) {
            for (field in clazz.declaredFields) {
                fields.add("${field.name}: ${field.type.simpleName}")
            }
            clazz = clazz.superclass
        }
        Log.d(TAG, "$label fields: $fields")
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        videoSource?.setVideoProcessor(null)
        processor?.disable()
        processor = null
        imageProcessor?.disable()
        imageProcessor = null
        videoSource = null
    }
}
