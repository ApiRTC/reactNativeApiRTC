package com.reactnativeapirtc

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.renderscript.Allocation
import android.renderscript.Element
import android.renderscript.RenderScript
import android.renderscript.ScriptIntrinsicBlur
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.Segmenter
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import org.webrtc.JavaI420Buffer
import org.webrtc.VideoFrame
import org.webrtc.VideoProcessor
import org.webrtc.VideoSink
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * BlurVideoProcessor implements WebRTC's VideoProcessor interface.
 *
 * When set on a VideoSource via videoSource.setVideoProcessor(processor),
 * it intercepts every camera frame BEFORE it reaches the VideoTrack.
 *
 * Flow:
 *   Camera → VideoProcessor.onFrameCaptured(frame) → process → downstreamSink.onFrame(processedFrame)
 *                                                                         ↓
 *                                                              VideoTrack → RTCView + Encoder
 */
class BlurVideoProcessor(private val context: Context) : VideoProcessor {

    companion object {
        private const val TAG = "BlurVideoProcessor"
        private const val SEGMENTATION_INTERVAL = 5
        private const val SEG_WIDTH = 160
        private const val SEG_HEIGHT = 120
        private const val SEGMENTATION_TIMEOUT_MS = 150L
        private const val SEGMENTATION_TIMEOUT_FIRST_MS = 600L
        private const val BLUR_RADIUS = 20f
    }

    @Volatile
    private var downstreamSink: VideoSink? = null

    private val enabled = AtomicBoolean(false)
    private var segmenter: Segmenter? = null
    private var renderScript: RenderScript? = null
    private var blurScript: ScriptIntrinsicBlur? = null
    private var frameCount = 0L

    @Volatile private var cachedMaskBuffer: ByteBuffer? = null
    @Volatile private var cachedMaskWidth = 0
    @Volatile private var cachedMaskHeight = 0

    private var blurredBitmap: Bitmap? = null
    private var compositeBitmap: Bitmap? = null

    // =====================================================================
    // VideoProcessor interface
    // =====================================================================

    override fun setSink(sink: VideoSink?) {
        Log.d(TAG, "setSink called, sink=${if (sink != null) "non-null" else "null"}")
        downstreamSink = sink
    }

    override fun onCapturerStarted(success: Boolean) {
        Log.d(TAG, "onCapturerStarted: success=$success")
    }

    override fun onCapturerStopped() {
        Log.d(TAG, "onCapturerStopped")
    }

    override fun onFrameCaptured(frame: VideoFrame) {
        val sink = downstreamSink
        if (sink == null) {
            Log.w(TAG, "onFrameCaptured: downstreamSink is null")
            return
        }

        if (!enabled.get()) {
            sink.onFrame(frame)
            return
        }

        try {
            val processedFrame = processFrame(frame)
            if (processedFrame != null) {
                sink.onFrame(processedFrame)
                processedFrame.release()
            } else {
                sink.onFrame(frame)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in onFrameCaptured, forwarding original", e)
            sink.onFrame(frame)
        }
    }

    fun onFrame(frame: VideoFrame) {
        onFrameCaptured(frame)
    }

    // =====================================================================
    // Enable / Disable
    // =====================================================================

    fun enable() {
        if (enabled.getAndSet(true)) return
        Log.d(TAG, "Enabling blur processor")

        try {
            val options = SelfieSegmenterOptions.Builder()
                .setDetectorMode(SelfieSegmenterOptions.STREAM_MODE)
                .enableRawSizeMask()
                .build()
            segmenter = Segmentation.getClient(options)
            Log.d(TAG, "ML Kit segmenter initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize ML Kit segmenter", e)
            enabled.set(false)
            throw e
        }

        try {
            renderScript = RenderScript.create(context)
            blurScript = ScriptIntrinsicBlur.create(renderScript, Element.U8_4(renderScript))
            blurScript?.setRadius(BLUR_RADIUS.coerceIn(1f, 25f))
            Log.d(TAG, "RenderScript initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize RenderScript", e)
            segmenter?.close()
            segmenter = null
            enabled.set(false)
            throw e
        }

        frameCount = 0
        cachedMaskBuffer = null
        Log.d(TAG, "Blur processor enabled")
    }

    fun disable() {
        if (!enabled.getAndSet(false)) return
        Log.d(TAG, "Disabling blur processor")

        segmenter?.close()
        segmenter = null
        blurScript?.destroy()
        blurScript = null
        renderScript?.destroy()
        renderScript = null

        blurredBitmap?.recycle()
        blurredBitmap = null
        compositeBitmap?.recycle()
        compositeBitmap = null
        cachedMaskBuffer = null

        Log.d(TAG, "Blur processor disabled")
    }

    // =====================================================================
    // Frame Processing Pipeline
    // =====================================================================

    private fun processFrame(frame: VideoFrame): VideoFrame? {
        val buffer = frame.buffer
        buffer.retain()

        try {
            val width = buffer.width
            val height = buffer.height

            val bitmap = i420ToBitmap(buffer, width, height)
            if (bitmap == null) {
                Log.w(TAG, "Failed to convert frame to bitmap")
                return null
            }

            frameCount++

            if (frameCount % SEGMENTATION_INTERVAL == 0L || cachedMaskBuffer == null) {
                updateSegmentationMask(bitmap)
            }

            val mask = cachedMaskBuffer
            if (mask == null) {
                if (frameCount == 1L || frameCount % 30L == 1L) {
                    Log.w(TAG, "No segmentation mask available yet (frame #$frameCount)")
                }
                bitmap.recycle()
                return null
            }

            applyBlurComposite(bitmap, width, height, mask, cachedMaskWidth, cachedMaskHeight)
            bitmap.recycle()

            val comp = compositeBitmap ?: run {
                Log.e(TAG, "compositeBitmap is null after applyBlurComposite")
                return null
            }

            val i420Buffer = bitmapToI420Buffer(comp, width, height)
            return VideoFrame(i420Buffer, frame.rotation, frame.timestampNs)

        } catch (e: Exception) {
            Log.e(TAG, "processFrame error", e)
            return null
        } finally {
            buffer.release()
        }
    }

    private fun updateSegmentationMask(bitmap: Bitmap) {
        val seg = segmenter ?: run {
            Log.e(TAG, "updateSegmentationMask: segmenter is null")
            return
        }

        val isFirstMask = cachedMaskBuffer == null
        val timeout = if (isFirstMask) SEGMENTATION_TIMEOUT_FIRST_MS else SEGMENTATION_TIMEOUT_MS

        try {
            val scaled = Bitmap.createScaledBitmap(bitmap, SEG_WIDTH, SEG_HEIGHT, true)
            val input = InputImage.fromBitmap(scaled, 0)

            val result = Tasks.await(
                seg.process(input),
                timeout,
                TimeUnit.MILLISECONDS
            )

            val maskBuf = result.buffer
            cachedMaskWidth = result.width
            cachedMaskHeight = result.height

            maskBuf.rewind()
            val newMask = ByteBuffer.allocateDirect(maskBuf.remaining())
            newMask.order(ByteOrder.nativeOrder())
            newMask.put(maskBuf)
            newMask.rewind()
            cachedMaskBuffer = newMask

            if (scaled !== bitmap) scaled.recycle()

        } catch (e: java.util.concurrent.TimeoutException) {
            if (isFirstMask) {
                Log.e(TAG, "Segmentation FIRST-CALL timeout (${timeout}ms) — ML Kit model may not be ready")
            } else {
                Log.d(TAG, "Segmentation timeout (${timeout}ms), using cached mask")
            }
        } catch (e: Exception) {
            if (isFirstMask) {
                Log.e(TAG, "Segmentation FIRST-CALL error", e)
            } else {
                Log.w(TAG, "Segmentation error (frame #$frameCount)", e)
            }
        }
    }

    private fun applyBlurComposite(
        original: Bitmap, width: Int, height: Int,
        maskBuffer: ByteBuffer, maskWidth: Int, maskHeight: Int
    ) {
        val rs = renderScript ?: run {
            Log.e(TAG, "applyBlurComposite: renderScript is null")
            return
        }
        val blur = blurScript ?: run {
            Log.e(TAG, "applyBlurComposite: blurScript is null")
            return
        }

        if (blurredBitmap == null || blurredBitmap!!.width != width || blurredBitmap!!.height != height) {
            blurredBitmap?.recycle()
            blurredBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        }
        if (compositeBitmap == null || compositeBitmap!!.width != width || compositeBitmap!!.height != height) {
            compositeBitmap?.recycle()
            compositeBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        }

        val blurInput = original.copy(Bitmap.Config.ARGB_8888, true)
        val inAlloc = Allocation.createFromBitmap(rs, blurInput)
        val outAlloc = Allocation.createFromBitmap(rs, blurredBitmap)
        blur.setInput(inAlloc)
        blur.forEach(outAlloc)
        outAlloc.copyTo(blurredBitmap)
        inAlloc.destroy()
        outAlloc.destroy()
        blurInput.recycle()

        val maskPixels = IntArray(maskWidth * maskHeight)
        maskBuffer.rewind()
        for (i in maskPixels.indices) {
            val conf = if (maskBuffer.remaining() >= 4) {
                (maskBuffer.float * 255).toInt().coerceIn(0, 255)
            } else 0
            maskPixels[i] = (conf shl 24) or 0x00FFFFFF
        }
        val maskBmp = Bitmap.createBitmap(maskPixels, maskWidth, maskHeight, Bitmap.Config.ARGB_8888)
        val scaledMask = if (maskWidth != width || maskHeight != height) {
            val s = Bitmap.createScaledBitmap(maskBmp, width, height, true)
            maskBmp.recycle()
            s
        } else maskBmp

        val canvas = Canvas(compositeBitmap!!)
        canvas.drawBitmap(blurredBitmap!!, 0f, 0f, null)
        val punchPaint = Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_OUT) }
        canvas.drawBitmap(scaledMask, 0f, 0f, punchPaint)
        val behindPaint = Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_OVER) }
        canvas.drawBitmap(original, 0f, 0f, behindPaint)
        scaledMask.recycle()
    }

    // =====================================================================
    // Color Space Conversions
    // =====================================================================

    private fun i420ToBitmap(buffer: VideoFrame.Buffer, width: Int, height: Int): Bitmap? {
        return try {
            val i420 = buffer.toI420() ?: return null

            val yPlane = i420.dataY
            val uPlane = i420.dataU
            val vPlane = i420.dataV
            val yStride = i420.strideY
            val uStride = i420.strideU
            val vStride = i420.strideV

            val nv21 = ByteArray(width * height * 3 / 2)

            for (row in 0 until height) {
                yPlane.position(row * yStride)
                yPlane.get(nv21, row * width, width)
            }

            val chromaHeight = height / 2
            val chromaWidth = width / 2
            for (row in 0 until chromaHeight) {
                for (col in 0 until chromaWidth) {
                    val nv21Offset = width * height + row * width + col * 2
                    vPlane.position(row * vStride + col)
                    nv21[nv21Offset] = vPlane.get()
                    uPlane.position(row * uStride + col)
                    nv21[nv21Offset + 1] = uPlane.get()
                }
            }

            i420.release()

            val yuvImage = android.graphics.YuvImage(
                nv21, android.graphics.ImageFormat.NV21, width, height, null
            )
            val out = java.io.ByteArrayOutputStream()
            yuvImage.compressToJpeg(android.graphics.Rect(0, 0, width, height), 85, out)
            val jpegBytes = out.toByteArray()
            val decoded = android.graphics.BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
            decoded?.copy(Bitmap.Config.ARGB_8888, true)?.also {
                decoded.recycle()
            }
        } catch (e: Exception) {
            Log.e(TAG, "I420→Bitmap error", e)
            null
        }
    }

    private fun bitmapToI420Buffer(bitmap: Bitmap, width: Int, height: Int): JavaI420Buffer {
        val argbBuffer = ByteBuffer.allocateDirect(width * height * 4)
        bitmap.copyPixelsToBuffer(argbBuffer)
        argbBuffer.rewind()

        val i420Buffer = JavaI420Buffer.allocate(width, height)
        val yBuf = i420Buffer.dataY
        val uBuf = i420Buffer.dataU
        val vBuf = i420Buffer.dataV

        for (y in 0 until height) {
            for (x in 0 until width) {
                val idx = (y * width + x) * 4
                val r = argbBuffer.get(idx).toInt() and 0xFF
                val g = argbBuffer.get(idx + 1).toInt() and 0xFF
                val b = argbBuffer.get(idx + 2).toInt() and 0xFF

                // BT.601 RGB → YUV
                val yVal = ((66 * r + 129 * g + 25 * b + 128) shr 8) + 16
                yBuf.put(y * i420Buffer.strideY + x, yVal.coerceIn(0, 255).toByte())

                if (y % 2 == 0 && x % 2 == 0) {
                    val uVal = ((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128
                    val vVal = ((112 * r - 94 * g - 18 * b + 128) shr 8) + 128
                    val chromaIdx = (y / 2) * i420Buffer.strideU + (x / 2)
                    uBuf.put(chromaIdx, uVal.coerceIn(0, 255).toByte())
                    vBuf.put(chromaIdx, vVal.coerceIn(0, 255).toByte())
                }
            }
        }

        return i420Buffer
    }
}
