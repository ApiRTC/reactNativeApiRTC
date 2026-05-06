package com.reactnativeapirtc

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
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
 * BackgroundImageProcessor implements WebRTC's VideoProcessor interface.
 *
 * Replaces the background with a provided Bitmap image, keeping the person
 * (detected via ML Kit Selfie Segmentation) sharp and in focus.
 *
 * Flow: Camera → onFrameCaptured → [segment + composite] → downstreamSink
 */
class BackgroundImageProcessor(private val backgroundBitmap: Bitmap) : VideoProcessor {

    companion object {
        private const val TAG = "BgImageProcessor"
        private const val SEGMENTATION_INTERVAL = 2
        private const val SEG_WIDTH = 256
        private const val SEG_HEIGHT = 192
        private const val SEGMENTATION_TIMEOUT_MS = 200L
        private const val SEGMENTATION_TIMEOUT_FIRST_MS = 600L
        private const val MASK_DECAY = 0.5f
        private const val MASK_THRESHOLD_LOW = 0.25f
        private const val MASK_THRESHOLD_HIGH = 0.50f
        private const val VERTICAL_FILL_EXTEND = 8
        private const val VERTICAL_FILL_ANCHOR = 0.55f
    }

    @Volatile
    private var downstreamSink: VideoSink? = null

    private val enabled = AtomicBoolean(false)
    private var segmenter: Segmenter? = null
    private var frameCount = 0L

    @Volatile private var cachedMaskBuffer: ByteBuffer? = null
    @Volatile private var cachedMaskWidth = 0
    @Volatile private var cachedMaskHeight = 0
    @Volatile private var previousMaskFloats: FloatArray? = null

    private var compositeBitmap: Bitmap? = null
    private var scaledBackground: Bitmap? = null
    private var cachedBgWidth = -1
    private var cachedBgHeight = -1
    private var cachedBgRotation = -1

    // =====================================================================
    // VideoProcessor interface
    // =====================================================================

    override fun setSink(sink: VideoSink?) {
        downstreamSink = sink
    }

    override fun onCapturerStarted(success: Boolean) {}

    override fun onCapturerStopped() {}

    override fun onFrameCaptured(frame: VideoFrame) {
        val sink = downstreamSink ?: return

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
            Log.e(TAG, "Error processing frame, forwarding original", e)
            sink.onFrame(frame)
        }
    }

    // =====================================================================
    // Enable / Disable
    // =====================================================================

    fun enable() {
        if (enabled.getAndSet(true)) return
        Log.d(TAG, "Enabling background image processor")

        val options = SelfieSegmenterOptions.Builder()
            .setDetectorMode(SelfieSegmenterOptions.STREAM_MODE)
            .enableRawSizeMask()
            .build()
        segmenter = Segmentation.getClient(options)

        frameCount = 0
        cachedMaskBuffer = null
        Log.d(TAG, "Background image processor enabled")
    }

    fun disable() {
        if (!enabled.getAndSet(false)) return
        Log.d(TAG, "Disabling background image processor")

        segmenter?.close()
        segmenter = null
        compositeBitmap?.recycle()
        compositeBitmap = null
        scaledBackground?.recycle()
        scaledBackground = null
        cachedMaskBuffer = null
        previousMaskFloats = null
        cachedBgWidth = -1
        cachedBgHeight = -1
        cachedBgRotation = -1

        Log.d(TAG, "Background image processor disabled")
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

            val bitmap = i420ToBitmap(buffer, width, height) ?: return null

            frameCount++
            if (frameCount % SEGMENTATION_INTERVAL == 0L || cachedMaskBuffer == null) {
                updateSegmentationMask(bitmap)
            }

            val mask = cachedMaskBuffer ?: run {
                bitmap.recycle()
                return null
            }

            // The raw frame buffer is always in the camera sensor orientation (landscape
            // for most phones), and frame.rotation tells the renderer how many degrees to
            // rotate the frame for display. We must pre-rotate the background by the
            // OPPOSITE angle so that after the renderer applies its rotation the image
            // appears upright and fills the display area.
            val rotation = frame.rotation
            if (scaledBackground == null ||
                cachedBgWidth != width ||
                cachedBgHeight != height ||
                cachedBgRotation != rotation) {
                scaledBackground?.recycle()
                // Effective display dimensions after renderer rotation
                val dispW = if (rotation == 90 || rotation == 270) height else width
                val dispH = if (rotation == 90 || rotation == 270) width else height
                // Center-crop to display aspect ratio, then pre-rotate to match raw frame
                val cropped = centerCropBitmap(backgroundBitmap, dispW, dispH)
                scaledBackground = if (rotation != 0) rotateBitmap(cropped, -rotation.toFloat()) else cropped
                cachedBgWidth = width
                cachedBgHeight = height
                cachedBgRotation = rotation
            }

            applyImageComposite(bitmap, width, height, mask, cachedMaskWidth, cachedMaskHeight)
            bitmap.recycle()

            val comp = compositeBitmap ?: return null
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
        val seg = segmenter ?: return
        val isFirstMask = cachedMaskBuffer == null
        val timeout = if (isFirstMask) SEGMENTATION_TIMEOUT_FIRST_MS else SEGMENTATION_TIMEOUT_MS

        try {
            val scaled = Bitmap.createScaledBitmap(bitmap, SEG_WIDTH, SEG_HEIGHT, true)
            val input = InputImage.fromBitmap(scaled, 0)

            val result = Tasks.await(seg.process(input), timeout, TimeUnit.MILLISECONDS)

            val maskBuf = result.buffer
            cachedMaskWidth = result.width
            cachedMaskHeight = result.height
            val size = cachedMaskWidth * cachedMaskHeight

            maskBuf.rewind()
            val rawFloats = FloatArray(size) { if (maskBuf.remaining() >= 4) maskBuf.float else 0f }

            // Column fill: connect upper and lower body in each column
            val filled = fillVerticalGaps(rawFloats, cachedMaskWidth, cachedMaskHeight)

            // Max-blend with decayed previous: fills transient holes, ghost fades in 2 frames
            val prev = previousMaskFloats
            val blended = if (prev != null && prev.size == size) {
                FloatArray(size) { i -> maxOf(filled[i], MASK_DECAY * prev[i]) }
            } else filled
            previousMaskFloats = blended

            val newMask = ByteBuffer.allocateDirect(size * 4)
            newMask.order(ByteOrder.nativeOrder())
            for (f in blended) newMask.putFloat(f)
            newMask.rewind()
            cachedMaskBuffer = newMask

            if (scaled !== bitmap) scaled.recycle()

        } catch (e: java.util.concurrent.TimeoutException) {
            Log.d(TAG, "Segmentation timeout, using cached mask")
        } catch (e: Exception) {
            Log.w(TAG, "Segmentation error (frame #$frameCount)", e)
        }
    }

    /**
     * Composite: background image → punch out person area → draw sharp person in front.
     */
    private fun fillVerticalGaps(floats: FloatArray, width: Int, height: Int): FloatArray {
        val out = floats.copyOf()
        for (x in 0 until width) {
            var topY = -1
            var bottomY = -1
            for (y in 0 until height) {
                if (floats[y * width + x] > VERTICAL_FILL_ANCHOR) {
                    if (topY == -1) topY = y
                    bottomY = y
                }
            }
            if (topY != -1) {
                val extendedBottom = minOf(bottomY + VERTICAL_FILL_EXTEND, height - 1)
                for (y in topY..extendedBottom) {
                    val idx = y * width + x
                    if (out[idx] < 0.6f) out[idx] = 0.6f
                }
            }
        }
        return out
    }

    private fun applyImageComposite(
        original: Bitmap, width: Int, height: Int,
        maskBuffer: ByteBuffer, maskWidth: Int, maskHeight: Int
    ) {
        val bg = scaledBackground ?: return

        if (compositeBitmap == null ||
            compositeBitmap!!.width != width ||
            compositeBitmap!!.height != height) {
            compositeBitmap?.recycle()
            compositeBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        }

        // Build mask bitmap from segmentation floats
        val maskPixels = IntArray(maskWidth * maskHeight)
        maskBuffer.rewind()
        for (i in maskPixels.indices) {
            val raw = if (maskBuffer.remaining() >= 4) maskBuffer.float else 0f
            val conf = when {
                raw < MASK_THRESHOLD_LOW  -> 0f
                raw > MASK_THRESHOLD_HIGH -> 1f
                else -> (raw - MASK_THRESHOLD_LOW) / (MASK_THRESHOLD_HIGH - MASK_THRESHOLD_LOW)
            }
            val alpha = (conf * 255).toInt().coerceIn(0, 255)
            maskPixels[i] = (alpha shl 24) or 0x00FFFFFF
        }
        val maskBmp = Bitmap.createBitmap(maskPixels, maskWidth, maskHeight, Bitmap.Config.ARGB_8888)
        val scaledMask = if (maskWidth != width || maskHeight != height) {
            val s = Bitmap.createScaledBitmap(maskBmp, width, height, true)
            maskBmp.recycle()
            s
        } else maskBmp

        // Build person layer: original pixels with alpha from mask.
        // At edges, alpha is partial → lerp between BG image and original → no halo.
        val personBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val personCanvas = Canvas(personBitmap)
        personCanvas.drawBitmap(original, 0f, 0f, null)
        val dstInPaint = Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN) }
        personCanvas.drawBitmap(scaledMask, 0f, 0f, dstInPaint)

        val canvas = Canvas(compositeBitmap!!)
        canvas.drawBitmap(bg, 0f, 0f, null)
        canvas.drawBitmap(personBitmap, 0f, 0f, null)
        scaledMask.recycle()
        personBitmap.recycle()
    }

    // =====================================================================
    // Bitmap Helpers
    // =====================================================================

    private fun rotateBitmap(src: Bitmap, degrees: Float): Bitmap {
        val matrix = android.graphics.Matrix().apply { postRotate(degrees) }
        val rotated = Bitmap.createBitmap(src, 0, 0, src.width, src.height, matrix, true)
        src.recycle()
        return rotated
    }

    private fun centerCropBitmap(src: Bitmap, targetWidth: Int, targetHeight: Int): Bitmap {
        val srcAspect = src.width.toFloat() / src.height
        val dstAspect = targetWidth.toFloat() / targetHeight

        val srcX: Int
        val srcY: Int
        val srcW: Int
        val srcH: Int

        if (srcAspect > dstAspect) {
            srcH = src.height
            srcW = (src.height * dstAspect).toInt()
            srcX = (src.width - srcW) / 2
            srcY = 0
        } else {
            srcW = src.width
            srcH = (src.width / dstAspect).toInt()
            srcX = 0
            srcY = (src.height - srcH) / 2
        }

        val cropped = Bitmap.createBitmap(src, srcX, srcY, srcW, srcH)
        val scaled = Bitmap.createScaledBitmap(cropped, targetWidth, targetHeight, true)
        if (cropped !== src) cropped.recycle()
        return scaled
    }

    // =====================================================================
    // Color Space Conversions (I420 ↔ Bitmap)
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
            decoded?.copy(Bitmap.Config.ARGB_8888, true)?.also { decoded.recycle() }
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
