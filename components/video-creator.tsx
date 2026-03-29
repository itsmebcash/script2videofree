"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  RotateCcw,
  Shuffle,
  Film,
  Clock,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Monitor,
  Smartphone,
  Square,
  Tv,
  Volume2,
  VolumeX,
} from "lucide-react"
import {
  VideoProcessor,
  VIDEO_ASPECT_RATIOS,
  type VideoChunk,
  type ProcessedVideo,
  type VideoAspectRatio,
} from "@/lib/video-processor"

interface VideoCreatorProps {
  chunks: VideoChunk[]
  audioFile?: File | null
  onVideoCreated?: (video: ProcessedVideo) => void
  onVideoCreating?: (isCreating: boolean) => void
  onRefreshVideos?: () => Promise<void>
}

export default function VideoCreator({
  chunks,
  audioFile,
  onVideoCreated,
  onVideoCreating,
  onRefreshVideos,
}: VideoCreatorProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState("")
  const [processedVideo, setProcessedVideo] = useState<ProcessedVideo | null>(null)
  const [videoHistory, setVideoHistory] = useState<ProcessedVideo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<VideoAspectRatio>(VIDEO_ASPECT_RATIOS[2]) // Default to 9:16
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const processorRef = useRef<VideoProcessor | null>(null)

  useEffect(() => {
    // Initialize video processor
    processorRef.current = new VideoProcessor()

    return () => {
      if (processorRef.current) {
        processorRef.current.cleanup()
      }
    }
  }, [])

  const getAspectRatioIcon = (ratio: string) => {
    switch (ratio) {
      case "1:1":
        return <Square className="h-4 w-4" />
      case "3:4":
        return <Smartphone className="h-4 w-4" />
      case "9:16":
        return <Smartphone className="h-4 w-4" />
      case "16:9":
        return <Monitor className="h-4 w-4" />
      default:
        return <Tv className="h-4 w-4" />
    }
  }

  const formatDuration = (seconds: number) => {
    const roundedSeconds = Math.round(seconds * 10) / 10 // Round to 1 decimal place
    const mins = Math.floor(roundedSeconds / 60)
    const secs = roundedSeconds % 60
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`
  }

  const handleCreateVideo = async (useRandomVideos = false) => {
    if (!processorRef.current || chunks.length === 0) return

    setIsProcessing(true)
    setProgress(0)
    setCurrentStage("Initializing video processor...")
    setError(null)
    setSuccessMessage(null)

    // Notify parent that video creation is starting
    if (onVideoCreating) {
      onVideoCreating(true)
    }

    try {
      console.log("Starting video creation with", chunks.length, "chunks in", selectedAspectRatio.ratio, "format")
      if (audioFile) {
        console.log("Including uploaded audio:", audioFile.name, audioFile.size, "bytes")
      }

      // Validate chunks have valid video URLs
      const validChunks = chunks.filter((chunk) => chunk.videoUrl && chunk.videoUrl.startsWith("http"))
      if (validChunks.length === 0) {
        throw new Error("No valid video URLs found. Please search for videos first.")
      }

      if (validChunks.length < chunks.length) {
        console.warn(`Only ${validChunks.length} of ${chunks.length} chunks have valid video URLs`)
      }

      // Process ALL valid chunks - no artificial limits
      const processChunks = [...validChunks]
      console.log(`Processing ALL ${processChunks.length} chunks for complete video duration`)

      const audioFileName = audioFile ? audioFile.name : undefined
      const actualAudioDuration = window.lastProcessedVideo?.audioDuration

      if (processChunks.length > 15) {
        console.log(`Processing ${processChunks.length} chunks - using efficient encoding for longer video`)
        // Use more efficient encoding for longer videos
        processorRef.current.setProcessingQuality("efficient")
      } else {
        processorRef.current.setProcessingQuality("high")
      }

      // For longer videos, adjust processing parameters
      const processChunksOriginal = [...validChunks]
      const audioFileNameOriginal = audioFile ? audioFile.name : undefined
      const actualAudioDurationOriginal = window.lastProcessedVideo?.audioDuration

      if (
        processChunksOriginal.length > 15 ||
        (audioFile && audioFileNameOriginal && actualAudioDurationOriginal && actualAudioDurationOriginal > 60)
      ) {
        // console.log("Processing longer video/audio - adjusting parameters for better performance")
        // Use more efficient encoding for longer videos
        // processorRef.current.setProcessingQuality("efficient")
      }

      // Calculate total operations for accurate progress
      // Each chunk: download (1) + process (1) = 2 operations per chunk + audio processing (1) + final concatenation (1) + initialization (1)
      const totalOperations = chunks.length * 2 + (audioFile ? 1 : 0) + 2 // +2 for initialization and concatenation, +1 for audio if present
      let completedOperations = 0

      const updateOverallProgress = (stage: string, operationProgress = 0) => {
        // Calculate progress based on completed operations plus current operation progress
        const baseProgress = (completedOperations / totalOperations) * 100
        const currentOpProgress = (operationProgress / 100) * (1 / totalOperations) * 100
        const overallProgress = Math.min(baseProgress + currentOpProgress, 100)

        setProgress(overallProgress)
        setCurrentStage(stage)
        console.log(`Overall Progress: ${Math.round(overallProgress)}% - ${stage}`)
      }

      // Initialize FFmpeg with retry logic
      setCurrentStage("Initializing video engine...")
      let initSuccess = false
      let initError: Error | null = null

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          setCurrentStage(`Loading video processing engine...`)
          await processorRef.current.initialize((initProgress) => {
            updateOverallProgress(`Setting up video processing environment...`, initProgress)
          })
          initSuccess = true
          break
        } catch (error) {
          initError = error as Error
          console.warn(`FFmpeg initialization attempt ${attempt} failed:`, error)
          if (attempt < 3) {
            setCurrentStage(`Retrying video engine setup...`)
            await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait 2 seconds before retry
          }
        }
      }

      if (!initSuccess) {
        throw new Error(
          `Failed to initialize video processor after 3 attempts. ${initError?.message || "Unknown error"}`,
        )
      }

      // Prepare chunks
      if (useRandomVideos) {
        setCurrentStage(`Selecting videos for ${selectedAspectRatio.ratio} format...`)
      }

      console.log(
        "Processing chunks:",
        processChunks.map((c) => ({ keyword: c.keyword, url: c.videoUrl })),
      )

      // Mark initialization as complete
      completedOperations++

      // Process video with selected aspect ratio and audio file
      const videoUrl = await processorRef.current.processVideoChunks(
        processChunks,
        selectedAspectRatio,
        audioFile, // Pass the audio file
        (videoProgress, stage, currentChunk, totalChunks) => {
          // Calculate which operation we're on based on current chunk
          const chunkOperationsCompleted = currentChunk ? (currentChunk - 1) * 2 : 0
          const currentOperationProgress = videoProgress

          updateOverallProgress(stage, currentOperationProgress)
        },
      )

      // Create processed video object
      const newVideo: ProcessedVideo = {
        id: `video-${Date.now()}`,
        url: videoUrl,
        duration: processChunks.reduce((acc, chunk) => acc + chunk.duration, 0),
        chunks: processChunks,
        createdAt: new Date(),
        aspectRatio: selectedAspectRatio,
        hasAudio: !!audioFile,
        audioSource: audioFile ? audioFile.name : undefined,
        actualDuration: window.lastProcessedVideo?.actualDuration,
        audioDuration: window.lastProcessedVideo?.audioDuration,
      }

      // Save to history
      setVideoHistory((prev) => [newVideo, ...prev.slice(0, 4)]) // Keep last 5 videos
      setProcessedVideo(newVideo)

      if (onVideoCreated) {
        onVideoCreated(newVideo)
      }

      setProgress(100)
      setCurrentStage(`${selectedAspectRatio.ratio} video ${audioFile ? "with audio " : ""}created successfully!`)
      setRetryCount(0) // Reset retry count on success
      console.log("Video creation completed successfully")
    } catch (error) {
      console.error("Error creating video:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to create video"

      // Provide helpful error messages and retry options
      if (errorMessage.includes("Failed to initialize video processor")) {
        setError(
          `${errorMessage}\n\nThis can happen due to browser security restrictions. Try refreshing the page or using a different browser.`,
        )
      } else if (errorMessage.includes("download") || errorMessage.includes("fetch")) {
        setError(`${errorMessage}\n\nTip: Check your internet connection and try again.`)
      } else if (errorMessage.includes("audio")) {
        setError(`${errorMessage}\n\nTip: Try with a different audio file format or without audio.`)
      } else {
        setError(`${errorMessage}\n\nYou can try again or use the 'Download ZIP' option as an alternative.`)
      }

      setRetryCount((prev) => prev + 1)
    } finally {
      setIsProcessing(false)
      // Notify parent that video creation is finished
      if (onVideoCreating) {
        onVideoCreating(false)
      }
    }
  }

  const handleRetry = () => {
    setError(null)
    handleCreateVideo(false)
  }

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleDownload = () => {
    if (processedVideo && processorRef.current) {
      const filename = `complete-video-${processedVideo.aspectRatio.ratio.replace(":", "x")}-${processedVideo.hasAudio ? "with-audio-" : ""}${processedVideo.id}.mp4`
      processorRef.current.downloadVideo(processedVideo.url, filename)
    }
  }

  const handleRollback = (video: ProcessedVideo) => {
    setProcessedVideo(video)
    setSelectedAspectRatio(video.aspectRatio)
    setIsPlaying(false)
  }

  const totalDuration = chunks.reduce((acc, chunk) => acc + chunk.duration, 0)

  const handleCreateNewVersion = async () => {
    if (!onRefreshVideos) {
      // Fallback to regular creation if no refresh function provided
      handleCreateVideo(true)
      return
    }

    setIsProcessing(true)
    setCurrentStage("Finding new videos for each keyword...")
    setError(null)
    setSuccessMessage(null)

    try {
      // First refresh all videos to get new content
      await onRefreshVideos()

      // Show success message but don't automatically create video
      setIsProcessing(false)
      setCurrentStage("")
      setSuccessMessage("New videos have been found! Click 'Create With New Videos' to generate a fresh version.")

      // Reset processed video to show the new create button
      setProcessedVideo(null)
    } catch (error) {
      console.error("Error refreshing videos:", error)
      setError("Failed to find new videos. Please try again.")
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-purple-200 shadow-lg">
        <CardHeader className="bg-purple-50">
          <CardTitle className="text-purple-900 flex items-center gap-2">
            <Film className="h-5 w-5" />
            Complete Video Creator
            {audioFile && (
              <Badge className="bg-green-100 text-green-800 border border-green-300">
                <Volume2 className="h-3 w-3 mr-1" />
                With Audio
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Audio File Info */}
          {audioFile && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Audio Integration
              </h4>
              <div className="text-sm text-green-700 space-y-1">
                <div>
                  <strong>File:</strong> {audioFile.name}
                </div>
                <div>
                  <strong>Size:</strong> {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                </div>
                <div>
                  <strong>Type:</strong> {audioFile.type}
                </div>
                <div className="text-xs text-green-600 mt-2">
                  • Your audio will be synchronized with the video segments
                  <br />• All video segments will be automatically muted
                  <br />• Final video will have your audio as the soundtrack
                </div>
              </div>
            </div>
          )}

          {/* Video Aspect Ratio Selection */}
          <div className="space-y-4">
            <h4 className="font-semibold text-purple-900 flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Video Format & Aspect Ratio
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {VIDEO_ASPECT_RATIOS.map((ratio) => (
                <div
                  key={ratio.ratio}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedAspectRatio.ratio === ratio.ratio
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-purple-300 hover:bg-purple-25"
                  }`}
                  onClick={() => setSelectedAspectRatio(ratio)}
                >
                  <div className="flex items-center gap-1 mb-2 flex-wrap">
                    {getAspectRatioIcon(ratio.ratio)}
                    <span className="font-semibold text-xs">{ratio.name}</span>
                    <Badge className="text-xs bg-purple-100 text-purple-800">{ratio.ratio}</Badge>
                  </div>
                  <div className="text-xs text-gray-600 mb-1 line-clamp-2">{ratio.description}</div>
                  <div className="text-xs text-purple-600 font-medium truncate">{ratio.platform}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {ratio.width}×{ratio.height}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-700">
                <strong>Selected:</strong> {selectedAspectRatio.name} ({selectedAspectRatio.ratio}) -{" "}
                {selectedAspectRatio.description}
                {audioFile && <span className="text-green-700"> • With synchronized audio</span>}
              </div>
            </div>
          </div>

          {/* Video Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
              <div className="text-lg font-bold text-purple-900">{chunks.length}</div>
              <div className="text-xs text-purple-700">Segments</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
              <div className="text-lg font-bold text-purple-900">{formatDuration(totalDuration)}</div>
              <div className="text-xs text-purple-700">Duration</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
              <div className="text-lg font-bold text-purple-900">{selectedAspectRatio.ratio}</div>
              <div className="text-xs text-purple-700">Format</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
              <div className="text-lg font-bold text-purple-900">
                {audioFile ? <Volume2 className="h-4 w-4 mx-auto" /> : <VolumeX className="h-4 w-4 mx-auto" />}
              </div>
              <div className="text-xs text-purple-700">{audioFile ? "With Audio" : "Video Only"}</div>
            </div>
          </div>

          {/* Feature Description */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Film className="h-4 w-4" />
              Smart Video Processing
            </h4>
            <p className="text-sm text-blue-700">
              All video segments will be automatically cropped and fitted to your selected {selectedAspectRatio.ratio}{" "}
              aspect ratio, then stitched together into one complete MP4 file optimized for{" "}
              {selectedAspectRatio.platform}.
              {audioFile && " Your uploaded audio will be synchronized with the video timeline."}
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-800 whitespace-pre-line">{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message Display */}
          {successMessage && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
            </Alert>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">{currentStage}</span>
                </div>
                <span className="text-lg font-bold text-purple-900">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-4 rounded-md" />
            </div>
          )}

          {/* Video Created Status */}
          {processedVideo && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-800 font-medium">
                  {selectedAspectRatio.ratio} video {processedVideo.hasAudio ? "with audio " : ""}created successfully!
                </span>
                <Badge className="bg-green-100 text-green-800 border border-green-300">
                  {formatDuration(processedVideo.duration)}
                </Badge>
                {processedVideo.hasAudio && (
                  <Badge className="bg-blue-100 text-blue-800 border border-blue-300">
                    <Volume2 className="h-3 w-3 mr-1" />
                    Audio Included
                  </Badge>
                )}
              </div>
              <p className="text-sm text-green-700 mt-2">
                Your video {processedVideo.hasAudio ? "with synchronized audio " : ""}is now available in the preview
                panel. You can create another version with different settings below.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!processedVideo ? (
              <>
                <Button
                  onClick={() => handleCreateVideo(false)}
                  disabled={isProcessing || chunks.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {currentStage.includes("Finding") ? "Finding New Videos..." : "Creating Video..."}
                    </>
                  ) : (
                    <>
                      <Film className="mr-2 h-5 w-5" />
                      {successMessage && successMessage.includes("New videos have been found")
                        ? "Create With New Videos"
                        : `Create ${selectedAspectRatio.ratio} Video${audioFile ? " with Audio" : ""}`}
                    </>
                  )}
                </Button>
                {error && retryCount < 3 && !error.includes("New videos have been found") && (
                  <Button
                    onClick={handleRetry}
                    disabled={isProcessing}
                    variant="outline"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    size="lg"
                  >
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Retry
                  </Button>
                )}
                {successMessage && successMessage.includes("New videos have been found") && (
                  <Button
                    onClick={handleCreateNewVersion}
                    disabled={isProcessing}
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    size="lg"
                  >
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Find Different Videos
                  </Button>
                )}
              </>
            ) : (
              <Button
                onClick={handleCreateNewVersion}
                disabled={isProcessing}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {currentStage.includes("Finding") ? "Finding New Videos..." : "Creating New Version..."}
                  </>
                ) : (
                  <>
                    <Shuffle className="mr-2 h-5 w-5" />
                    Find New Videos
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Video History */}
          {videoHistory.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-purple-900">Previous Versions</h4>
              <div className="grid gap-2 max-h-32 overflow-y-auto">
                {videoHistory.map((video, index) => (
                  <div
                    key={video.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      processedVideo?.id === video.id
                        ? "bg-purple-100 border-purple-300"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    }`}
                    onClick={() => handleRollback(video)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-6 bg-purple-200 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-800">{index + 1}</span>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium flex items-center gap-2">
                          {video.aspectRatio.name} Video
                          <Badge className="text-xs bg-purple-100 text-purple-800">{video.aspectRatio.ratio}</Badge>
                          {video.hasAudio && (
                            <Badge className="text-xs bg-green-100 text-green-800">
                              <Volume2 className="h-3 w-3 mr-1" />
                              Audio
                            </Badge>
                          )}
                        </div>
                        <div className="text-gray-600">
                          {formatDuration(video.duration)} • {video.aspectRatio.width}×{video.aspectRatio.height}
                          {video.audioSource && <span className="text-green-600"> • {video.audioSource}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {processedVideo?.id === video.id && (
                        <Badge className="bg-purple-100 text-purple-800 border border-purple-300 text-xs">
                          Current
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRollback(video)
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Segment Preview */}
          <div className="space-y-3">
            <h4 className="font-semibold text-purple-900">Video Segments to Stitch</h4>
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {chunks.map((chunk, index) => (
                <div key={chunk.id} className="flex gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{index + 1}</span>
                    </div>
                  </div>
                  <div className="flex-1 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800 border border-purple-300 text-xs">
                        {chunk.keyword}
                      </Badge>
                      <span className="text-xs text-purple-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(chunk.duration)}
                      </span>
                      {audioFile && (
                        <Badge className="bg-green-100 text-green-800 border border-green-300 text-xs">
                          <VolumeX className="h-3 w-3 mr-1" />
                          Muted
                        </Badge>
                      )}
                    </div>
                    <p className="text-purple-900 font-medium line-clamp-1">"{chunk.text}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">Video Creation Tips</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>
                • Videos will be automatically cropped and fitted to your selected {selectedAspectRatio.ratio} aspect
                ratio
              </li>
              <li>• All segments will be trimmed to match your script timing</li>
              <li>• The final video will be optimized for {selectedAspectRatio.platform}</li>
              {audioFile && (
                <>
                  <li>• Your uploaded audio will be synchronized with the video timeline</li>
                  <li>• All video segments will be automatically muted to prevent audio conflicts</li>
                </>
              )}
              <li>• You can change the aspect ratio and recreate the video anytime</li>
              <li>• If creation fails, try refreshing the page and trying again</li>
            </ul>
          </div>
        </CardContent>
      </Card>
      {processedVideo && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-green-800 font-medium">
              {selectedAspectRatio.ratio} video {processedVideo.hasAudio ? "with audio " : ""}created successfully!
            </span>
            <Badge className="bg-green-100 text-green-800 border border-green-300">
              {(() => {
                const displayDuration = processedVideo.actualDuration || processedVideo.duration
                return formatDuration(displayDuration)
              })()}
            </Badge>
            {processedVideo.hasAudio && (
              <Badge className="bg-blue-100 text-blue-800 border border-blue-300">
                <Volume2 className="h-3 w-3 mr-1" />
                Audio Included
              </Badge>
            )}
          </div>
          <p className="text-sm text-green-700 mt-2">
            Your video {processedVideo.hasAudio ? "with synchronized audio " : ""}is now available in the preview panel.
            You can create another version with different settings below.
          </p>
        </div>
      )}
    </div>
  )
}
