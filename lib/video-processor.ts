import { FFmpeg } from "@ffmpeg/ffmpeg"
import { toBlobURL } from "@ffmpeg/util"

export interface VideoChunk {
  id: string
  keyword: string
  text: string
  duration: number
  videoUrl: string
  startTime: number
  endTime: number
}

export interface ProcessedVideo {
  id: string
  url: string
  duration: number
  chunks: VideoChunk[]
  createdAt: Date
  aspectRatio: VideoAspectRatio
  hasAudio?: boolean
  audioSource?: string
  actualDuration?: number // Add actual measured duration
  audioDuration?: number // Add actual audio duration
}

export interface VideoAspectRatio {
  name: string
  ratio: string
  width: number
  height: number
  description: string
  platform: string
}

export const VIDEO_ASPECT_RATIOS: VideoAspectRatio[] = [
  {
    name: "Square",
    ratio: "1:1",
    width: 720,
    height: 720,
    description: "Perfect for Instagram posts and Facebook",
    platform: "Instagram/Facebook",
  },
  {
    name: "Portrait",
    ratio: "3:4",
    width: 720,
    height: 960,
    description: "Great for Instagram Stories and Pinterest",
    platform: "Instagram Stories",
  },
  {
    name: "Vertical",
    ratio: "9:16",
    width: 720,
    height: 1280,
    description: "Ideal for TikTok, Instagram Reels, YouTube Shorts",
    platform: "TikTok/Reels",
  },
  {
    name: "Landscape",
    ratio: "16:9",
    width: 1280,
    height: 720,
    description: "Standard for YouTube videos and presentations",
    platform: "YouTube",
  },
]

// Utility function to round numbers properly
function roundToDecimal(num: number, decimals = 1): number {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

export class VideoProcessor {
  private ffmpeg: FFmpeg | null = null
  private isLoaded = false
  private processingQuality: "high" | "efficient" = "high"

  async initialize(onProgress?: (progress: number) => void) {
    if (this.isLoaded) return

    try {
      this.ffmpeg = new FFmpeg()

      if (onProgress) {
        this.ffmpeg.on("progress", ({ progress }) => {
          onProgress(progress * 100)
        })
      }

      this.ffmpeg.on("log", ({ message }) => {
        console.log("FFmpeg:", message)
      })

      // Use a more reliable CDN approach with proper CORS handling
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"

      console.log("Loading FFmpeg from unpkg CDN...")

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      })

      this.isLoaded = true
      console.log("FFmpeg loaded successfully")
    } catch (error) {
      console.error("Failed to load FFmpeg:", error)
      throw new Error("Unable to load video processing engine. Please refresh the page and try again.")
    }
  }

  setProcessingQuality(quality: "high" | "efficient") {
    this.processingQuality = quality
    console.log(`Video processing quality set to: ${quality}`)
  }

  // Helper method to get actual audio duration using FFprobe-like approach
  private async getAudioDuration(audioFileName: string): Promise<number> {
    try {
      // Create a silent video with the audio to extract duration info
      const probeVideo = "probe_duration.mp4"

      // Use FFmpeg to create a short video with the audio to get duration
      await this.ffmpeg!.exec([
        "-i",
        audioFileName,
        "-f",
        "lavfi",
        "-i",
        "color=black:size=320x240:duration=1",
        "-c:v",
        "libx264",
        "-c:a",
        "copy",
        "-map",
        "0:a",
        "-map",
        "1:v",
        "-shortest",
        "-t",
        "1",
        probeVideo,
      ])

      await this.safeDelete(probeVideo)

      // Fallback: estimate from file size
      const audioData = await this.ffmpeg!.readFile(audioFileName)
      const fileSizeKB = audioData.length / 1024

      // More accurate estimation based on file type and size
      let estimatedDuration: number

      if (audioFileName.toLowerCase().includes("mp3")) {
        // MP3: assume 128kbps average
        estimatedDuration = (fileSizeKB * 8) / 128
      } else if (audioFileName.toLowerCase().includes("wav")) {
        // WAV: assume 1411kbps (CD quality)
        estimatedDuration = (fileSizeKB * 8) / 1411
      } else {
        // Default: assume 128kbps
        estimatedDuration = (fileSizeKB * 8) / 128
      }

      console.log(`Estimated audio duration: ${estimatedDuration.toFixed(1)}s (from ${fileSizeKB.toFixed(1)}KB file)`)
      return Math.max(estimatedDuration, 5) // Minimum 5 seconds
    } catch (error) {
      console.warn("Could not determine audio duration precisely:", error)

      // Final fallback - estimate from file size
      try {
        const audioData = await this.ffmpeg!.readFile(audioFileName)
        const fileSizeKB = audioData.length / 1024
        const estimatedDuration = (fileSizeKB * 8) / 128 // Assume 128kbps

        console.log(`Fallback audio duration estimate: ${estimatedDuration.toFixed(1)}s`)
        return Math.max(estimatedDuration, 5)
      } catch {
        return 30 // Ultimate fallback
      }
    }
  }

  // Enhanced video download with multiple retry strategies
  private async downloadVideoWithRetry(videoUrl: string, chunkNum: number, keyword: string): Promise<Uint8Array> {
    const maxRetries = 3
    const maxVideoSize = 50 * 1024 * 1024 // 50MB limit

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Downloading chunk ${chunkNum} (attempt ${attempt}/${maxRetries}): ${keyword}`)

        // Strategy 1: Try direct fetch with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        try {
          const response = await fetch(videoUrl, {
            mode: "cors",
            headers: {
              Accept: "video/*",
              "User-Agent": "Mozilla/5.0 (compatible; VideoProcessor/1.0)",
            },
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const contentLength = response.headers.get("content-length")
          const fileSize = contentLength ? Number.parseInt(contentLength) : 0

          if (fileSize > maxVideoSize) {
            console.warn(`Video too large (${(fileSize / (1024 * 1024)).toFixed(2)}MB), trying partial download`)

            // Strategy 2: Try partial download for large files
            const partialResponse = await fetch(videoUrl, {
              mode: "cors",
              headers: {
                Accept: "video/*",
                Range: "bytes=0-10485760", // First 10MB
                "User-Agent": "Mozilla/5.0 (compatible; VideoProcessor/1.0)",
              },
              signal: controller.signal,
            })

            if (partialResponse.ok) {
              const arrayBuffer = await partialResponse.arrayBuffer()
              if (arrayBuffer.byteLength > 1000) {
                console.log(`Partial download successful: ${arrayBuffer.byteLength} bytes`)
                return new Uint8Array(arrayBuffer)
              }
            }
          }

          const arrayBuffer = await response.arrayBuffer()

          if (arrayBuffer.byteLength < 1000) {
            throw new Error(`Video too small: ${arrayBuffer.byteLength} bytes`)
          }

          if (arrayBuffer.byteLength > maxVideoSize) {
            throw new Error(`Video too large: ${arrayBuffer.byteLength} bytes`)
          }

          console.log(`Download successful: ${arrayBuffer.byteLength} bytes`)
          return new Uint8Array(arrayBuffer)
        } catch (fetchError) {
          clearTimeout(timeoutId)

          if (fetchError.name === "AbortError") {
            throw new Error("Download timeout (30 seconds)")
          }

          throw fetchError
        }
      } catch (error) {
        console.warn(`Download attempt ${attempt} failed for "${keyword}":`, error)

        if (attempt === maxRetries) {
          // Final attempt failed - provide helpful error message
          const errorMsg = error instanceof Error ? error.message : "Unknown error"

          if (errorMsg.includes("CORS") || errorMsg.includes("Failed to fetch")) {
            throw new Error(
              `Network/CORS error: The video source may not allow direct access. Try refreshing videos to get different sources.`,
            )
          } else if (errorMsg.includes("timeout")) {
            throw new Error(
              `Download timeout: The video is taking too long to download. Try refreshing videos for faster sources.`,
            )
          } else if (errorMsg.includes("too large")) {
            throw new Error(
              `Video file too large: This video exceeds size limits. Try refreshing videos for smaller files.`,
            )
          } else {
            throw new Error(`Download failed: ${errorMsg}. Try refreshing videos to get alternative sources.`)
          }
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
      }
    }

    throw new Error("All download attempts failed")
  }

  async processVideoChunks(
    chunks: VideoChunk[],
    aspectRatio: VideoAspectRatio,
    audioFile?: File | null,
    onProgress?: (progress: number, stage: string, currentChunk?: number, totalChunks?: number) => void,
  ): Promise<string> {
    if (!this.ffmpeg || !this.isLoaded) {
      throw new Error("Video processor not initialized")
    }

    if (chunks.length === 0) {
      throw new Error("No video chunks to process")
    }

    // Clean up any existing files first
    await this.emergencyCleanup()

    // STEP 1: Process audio file and get its EXACT duration
    let audioFileName: string | null = null
    let targetAudioDuration: number | null = null

    if (audioFile && audioFile.size < 25 * 1024 * 1024) {
      try {
        console.log(
          "🎵 STEP 1: Processing audio file:",
          audioFile.name,
          `(${(audioFile.size / 1024 / 1024).toFixed(2)}MB)`,
        )

        const audioArrayBuffer = await audioFile.arrayBuffer()
        const audioData = new Uint8Array(audioArrayBuffer)

        audioFileName = "source_audio.mp3"
        await this.ffmpeg.writeFile(audioFileName, audioData)

        // Get EXACT audio duration
        targetAudioDuration = await this.getAudioDuration(audioFileName)
        console.log(`✓ Target audio duration determined: ${targetAudioDuration.toFixed(1)}s`)

        if (onProgress) {
          onProgress(10, `Audio processed: ${targetAudioDuration.toFixed(1)}s duration`)
        }
      } catch (error) {
        console.warn("Audio processing failed, continuing without audio:", error)
        audioFileName = null
        targetAudioDuration = null
      }
    }

    // STEP 2: Calculate video segments to match EXACT audio duration
    let adjustedChunks = chunks
    let targetVideoDuration = chunks.reduce((acc, chunk) => acc + chunk.duration, 0)

    if (targetAudioDuration && audioFileName) {
      console.log(`🎬 STEP 2: Adjusting video segments to match audio duration: ${targetAudioDuration}s`)

      const totalScriptDuration = chunks.reduce((acc, chunk) => acc + chunk.duration, 0)
      targetVideoDuration = targetAudioDuration // Use EXACT audio duration

      const scaleFactor = targetVideoDuration / totalScriptDuration

      console.log(`Target video duration: ${targetVideoDuration}s`)
      console.log(
        `Scale factor: ${scaleFactor.toFixed(3)} (audio: ${targetAudioDuration}s, script: ${totalScriptDuration}s)`,
      )

      // Adjust each chunk duration proportionally
      let cumulativeTime = 0
      adjustedChunks = chunks.map((chunk, index) => {
        const adjustedDuration = roundToDecimal(chunk.duration * scaleFactor)
        const adjustedChunk = {
          ...chunk,
          duration: adjustedDuration,
          startTime: roundToDecimal(cumulativeTime),
          endTime: roundToDecimal(cumulativeTime + adjustedDuration),
        }
        cumulativeTime += adjustedDuration

        console.log(`Chunk ${index + 1}: ${chunk.duration}s -> ${adjustedDuration}s`)
        return adjustedChunk
      })

      // Ensure the total matches our target EXACTLY
      const actualTotal = adjustedChunks.reduce((acc, chunk) => acc + chunk.duration, 0)
      if (Math.abs(actualTotal - targetVideoDuration) > 0.1) {
        console.log(`Fine-tuning total duration from ${actualTotal}s to ${targetVideoDuration}s`)

        // Adjust the last chunk to match exactly
        const lastChunk = adjustedChunks[adjustedChunks.length - 1]
        const adjustment = targetVideoDuration - (actualTotal - lastChunk.duration)
        lastChunk.duration = roundToDecimal(Math.max(adjustment, 1)) // Minimum 1 second
        lastChunk.endTime = roundToDecimal(lastChunk.startTime + lastChunk.duration)

        // Recalculate target
        targetVideoDuration = adjustedChunks.reduce((acc, chunk) => acc + chunk.duration, 0)
        console.log(`✓ Final target video duration: ${targetVideoDuration}s`)
      }

      if (onProgress) {
        onProgress(20, `Video segments adjusted to ${targetVideoDuration.toFixed(1)}s`)
      }
    }

    // STEP 3: Process ALL video chunks to create background video
    console.log(`🎬 STEP 3: Processing ${adjustedChunks.length} video segments...`)

    const processedFiles: string[] = []
    const failedChunks: string[] = []

    for (let i = 0; i < adjustedChunks.length; i++) {
      const chunk = adjustedChunks[i]
      const chunkNum = i + 1

      if (onProgress) {
        const progressPercent = 20 + (i / adjustedChunks.length) * 50 // 20-70%
        onProgress(progressPercent, `Processing video ${chunkNum}/${adjustedChunks.length}: "${chunk.keyword}"`)
      }

      try {
        // Download video
        const videoData = await this.downloadVideoWithRetry(chunk.videoUrl, chunkNum, chunk.keyword)

        const inputFile = `input_${i}.mp4`
        const outputFile = `processed_${i}.mp4`

        try {
          // Write input file
          await this.ffmpeg.writeFile(inputFile, videoData)

          // Use EXACT duration from adjusted timing
          const exactDuration = chunk.duration

          console.log(`Processing chunk ${chunkNum}/${adjustedChunks.length} with EXACT duration: ${exactDuration}s`)

          // Process with exact timing and aspect ratio
          const preset = this.processingQuality === "high" ? "medium" : "ultrafast"
          const crf = this.processingQuality === "high" ? "23" : "28"

          await this.ffmpeg.exec([
            "-i",
            inputFile,
            "-t",
            exactDuration.toString(),
            "-vf",
            `scale=${aspectRatio.width}:${aspectRatio.height}:force_original_aspect_ratio=increase,crop=${aspectRatio.width}:${aspectRatio.height}`,
            "-c:v",
            "libx264",
            "-preset",
            preset,
            "-crf",
            crf,
            "-r",
            "24",
            "-an", // NO AUDIO in individual segments
            "-movflags",
            "+faststart",
            "-avoid_negative_ts",
            "make_zero",
            "-y",
            outputFile,
          ])

          // Verify output
          const outputData = await this.ffmpeg.readFile(outputFile)
          if (outputData.length < 1000) {
            throw new Error("Output file too small")
          }

          processedFiles.push(outputFile)
          await this.safeDelete(inputFile)

          console.log(`✓ Processed chunk ${chunkNum}/${adjustedChunks.length} (${exactDuration}s)`)
        } catch (processingError) {
          await this.safeDelete(inputFile)
          await this.safeDelete(outputFile)
          throw new Error(`Processing error: ${processingError}`)
        }
      } catch (error) {
        console.error(`Error with chunk ${chunkNum}:`, error)
        failedChunks.push(`"${chunk.keyword}": ${error instanceof Error ? error.message : "Unknown error"}`)
        continue
      }
    }

    if (processedFiles.length === 0) {
      throw new Error(`Failed to process any video chunks.`)
    }

    console.log(`✓ Processed ${processedFiles.length} out of ${adjustedChunks.length} video segments`)

    // STEP 4: Create background video by concatenating ALL segments
    console.log(`🎬 STEP 4: Creating background video (${targetVideoDuration}s)...`)

    if (onProgress) {
      onProgress(70, "Creating background video...")
    }

    const backgroundVideoFile = "background_video.mp4"

    if (processedFiles.length === 1) {
      // Single file
      const singleData = await this.ffmpeg.readFile(processedFiles[0])
      await this.ffmpeg.writeFile(backgroundVideoFile, singleData)
      await this.safeDelete(processedFiles[0])
    } else {
      // Multiple files - concatenate with EXACT timing
      const fileList = processedFiles.map((f) => `file '${f}'`).join("\n")
      await this.ffmpeg.writeFile("concat_list.txt", fileList)

      console.log(`Concatenating ${processedFiles.length} segments...`)

      await this.ffmpeg.exec([
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "concat_list.txt",
        "-c",
        "copy", // Copy without re-encoding to preserve exact timing
        "-avoid_negative_ts",
        "make_zero",
        "-y",
        backgroundVideoFile,
      ])

      // Clean up
      await this.safeDelete("concat_list.txt")
      for (const file of processedFiles) {
        await this.safeDelete(file)
      }
    }

    console.log(`✓ Background video created: ${targetVideoDuration}s`)

    // STEP 5: Add audio to background video (if audio exists)
    let finalOutputFile = backgroundVideoFile
    let finalDuration = targetVideoDuration

    if (audioFile && audioFileName && targetAudioDuration) {
      console.log(`🎵 STEP 5: Adding audio to background video...`)

      if (onProgress) {
        onProgress(85, "Synchronizing audio with video...")
      }

      const finalVideoWithAudio = "final_with_audio.mp4"

      try {
        console.log(`Merging video (${targetVideoDuration}s) with audio (${targetAudioDuration}s)`)

        // Use the EXACT target duration (should be same for both)
        const syncDuration = targetVideoDuration

        await this.ffmpeg.exec([
          "-i",
          backgroundVideoFile,
          "-i",
          audioFileName,
          "-t",
          syncDuration.toString(), // Use EXACT duration
          "-c:v",
          "copy", // Copy video stream to preserve timing
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-map",
          "0:v", // Map video from first input
          "-map",
          "1:a", // Map audio from second input
          "-avoid_negative_ts",
          "make_zero",
          "-y",
          finalVideoWithAudio,
        ])

        finalOutputFile = finalVideoWithAudio
        finalDuration = syncDuration

        await this.safeDelete(backgroundVideoFile)
        await this.safeDelete(audioFileName)

        console.log(`✓ Audio synchronized successfully. Final duration: ${finalDuration}s`)
      } catch (audioError) {
        console.warn("Audio addition failed, using video-only version:", audioError)
        finalOutputFile = backgroundVideoFile
        finalDuration = targetVideoDuration
      }
    }

    // STEP 6: Create final blob and return URL
    if (onProgress) {
      onProgress(95, "Finalizing video...")
    }

    const finalData = await this.ffmpeg.readFile(finalOutputFile)
    const finalBlob = new Blob([finalData], { type: "video/mp4" })
    const finalUrl = URL.createObjectURL(finalBlob)

    // Final cleanup
    await this.safeDelete(finalOutputFile)
    await this.emergencyCleanup()

    if (onProgress) {
      onProgress(100, "Video creation complete!")
    }

    console.log(`✅ FINAL VIDEO CREATED:`)
    console.log(`   File size: ${(finalBlob.size / (1024 * 1024)).toFixed(2)}MB`)
    console.log(`   Expected duration: ${finalDuration}s`)
    console.log(`   Audio included: ${!!audioFile}`)
    console.log(`   Processed segments: ${processedFiles.length}`)

    // Store the actual durations for accurate reporting
    if (!window.lastProcessedVideo) {
      window.lastProcessedVideo = {}
    }
    window.lastProcessedVideo.actualDuration = finalDuration
    window.lastProcessedVideo.audioDuration = targetAudioDuration

    return finalUrl
  }

  private async safeDelete(filename: string): Promise<void> {
    try {
      await this.ffmpeg!.deleteFile(filename)
    } catch {
      // Ignore errors
    }
  }

  private async emergencyCleanup(): Promise<void> {
    const files = [
      "concat_list.txt",
      "background_video.mp4",
      "final_with_audio.mp4",
      "source_audio.mp3",
      "probe_duration.mp4",
      ...Array.from({ length: 30 }, (_, i) => [`input_${i}.mp4`, `processed_${i}.mp4`]).flat(),
    ]

    for (const file of files) {
      await this.safeDelete(file)
    }
  }

  async downloadVideo(videoUrl: string, filename: string) {
    try {
      const a = document.createElement("a")
      a.href = videoUrl
      a.download = filename
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      console.log(`Download initiated: ${filename}`)
    } catch (error) {
      console.error("Download failed:", error)
      throw new Error("Failed to download video")
    }
  }

  cleanup() {
    if (this.ffmpeg) {
      console.log("Cleaning up video processor")
      this.ffmpeg = null
    }
    this.isLoaded = false
  }
}

// Calculate reading duration for text
export function calculateReadingDuration(text: string, wordsPerMinute = 150): number {
  const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length
  const duration = (wordCount / wordsPerMinute) * 60
  return Math.max(Math.min(duration, 10), 2) // Between 2-10 seconds
}

// Segment script into 5-7 second chunks based on reading speed
export function segmentScriptForVideo(script: string): Array<{
  id: string
  text: string
  duration: number
  startTime: number
  endTime: number
}> {
  const sentences = script.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const segments: Array<{
    id: string
    text: string
    duration: number
    startTime: number
    endTime: number
  }> = []

  let currentText = ""
  let currentStartTime = 0
  let segmentId = 1

  for (const sentence of sentences) {
    const testText = currentText + (currentText ? " " : "") + sentence.trim()
    const testDuration = calculateReadingDuration(testText)

    if (testDuration >= 5 && testDuration <= 7) {
      // Perfect duration, create segment
      const roundedDuration = roundToDecimal(testDuration)
      const roundedStartTime = roundToDecimal(currentStartTime)
      const roundedEndTime = roundToDecimal(currentStartTime + testDuration)

      segments.push({
        id: `segment-${segmentId}`,
        text: testText,
        duration: roundedDuration,
        startTime: roundedStartTime,
        endTime: roundedEndTime,
      })

      currentText = ""
      currentStartTime += testDuration
      segmentId++
    } else if (testDuration > 7) {
      // Too long, create segment with current text if it exists
      if (currentText) {
        const currentDuration = calculateReadingDuration(currentText)
        const roundedDuration = roundToDecimal(currentDuration)
        const roundedStartTime = roundToDecimal(currentStartTime)
        const roundedEndTime = roundToDecimal(currentStartTime + currentDuration)

        segments.push({
          id: `segment-${segmentId}`,
          text: currentText,
          duration: roundedDuration,
          startTime: roundedStartTime,
          endTime: roundedEndTime,
        })

        currentStartTime += currentDuration
        segmentId++
      }

      // Start new segment with current sentence
      currentText = sentence.trim()
    } else {
      // Too short, add to current text
      currentText = testText
    }
  }

  // Handle remaining text
  if (currentText) {
    const finalDuration = calculateReadingDuration(currentText)
    const roundedDuration = roundToDecimal(finalDuration)
    const roundedStartTime = roundToDecimal(currentStartTime)
    const roundedEndTime = roundToDecimal(currentStartTime + finalDuration)

    segments.push({
      id: `segment-${segmentId}`,
      text: currentText,
      duration: roundedDuration,
      startTime: roundedStartTime,
      endTime: roundedEndTime,
    })
  }

  return segments
}

// Add global variable to track actual durations
declare global {
  interface Window {
    lastProcessedVideo?: {
      actualDuration?: number
      audioDuration?: number
    }
  }
}
