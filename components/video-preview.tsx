"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Play, Film, ExternalLink, Download, CheckCircle, Pause, Loader2, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import type { ProcessedVideo } from "@/lib/video-processor"

interface VideoClip {
  id: string
  keyword: string
  url: string | null
  thumbnail: string
  text: string
  pexelsVideo?: {
    id: number
    user: { name: string }
    url: string
    duration: number
  }
}

interface VideoPreviewProps {
  clips?: VideoClip[]
  createdVideo?: ProcessedVideo | null
  isCreatingVideo?: boolean
  onCreateAnother?: () => void
}

export default function VideoPreview({ clips, createdVideo, isCreatingVideo, onCreateAnother }: VideoPreviewProps) {
  const [selectedClip, setSelectedClip] = useState<VideoClip | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const formatDuration = (seconds: number) => {
    const roundedSeconds = Math.round(seconds * 10) / 10 // Round to 1 decimal place
    const mins = Math.floor(roundedSeconds / 60)
    const secs = roundedSeconds % 60
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`
  }

  const handlePlayPause = (videoElement: HTMLVideoElement) => {
    if (isPlaying) {
      videoElement.pause()
    } else {
      videoElement.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleDownloadVideo = (video: ProcessedVideo) => {
    try {
      const a = document.createElement("a")
      a.href = video.url
      a.download = `complete-video-${video.aspectRatio.ratio.replace(":", "x")}-${video.id}.mp4`
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      console.log(`Download initiated: complete-video-${video.aspectRatio.ratio.replace(":", "x")}-${video.id}.mp4`)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  // If we're creating a video, show loading state
  if (isCreatingVideo) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-medium">Video Preview</h3>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="text-blue-800 font-medium">Complete Video Ready</span>
            </div>
          </div>

          <div className="relative rounded-lg overflow-hidden bg-gray-100 aspect-video flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <div>
                <h4 className="font-medium text-gray-900">Creating Your Video...</h4>
                <p className="text-sm text-gray-600 mt-1">Processing and stitching video segments together</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If we have a created video, show it prominently
  if (createdVideo) {
    const displayDuration = createdVideo.actualDuration || createdVideo.duration

    return (
      <div className="space-y-4">
        <h3 className="text-xl font-medium">Video Preview</h3>

        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-800 font-medium">Complete Video Ready</span>
            </div>
          </div>

          <div
            className="relative rounded-lg overflow-hidden bg-black mx-auto"
            style={{
              aspectRatio: `${createdVideo.aspectRatio.width}/${createdVideo.aspectRatio.height}`,
              maxWidth: "100%",
              maxHeight: "400px",
            }}
          >
            <video
              src={createdVideo.url}
              className="w-full h-full object-contain"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              controls
              poster="/placeholder.svg?height=360&width=640"
            >
              Your browser does not support the video tag.
            </video>

            {/* Play/Pause Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
              <Button
                variant="secondary"
                size="lg"
                onClick={(e) => {
                  const video = e.currentTarget.parentElement?.previousElementSibling as HTMLVideoElement
                  if (video) handlePlayPause(video)
                }}
                className="bg-white/90 hover:bg-white"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800 border border-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {createdVideo.aspectRatio.ratio} Video Complete
                </Badge>
                <span className="text-sm text-gray-600">
                  {formatDuration(displayDuration)} • {createdVideo.chunks.length} segments •{" "}
                  {createdVideo.aspectRatio.width}×{createdVideo.aspectRatio.height}
                  {createdVideo.audioDuration && (
                    <span className="text-purple-600"> • Audio: {formatDuration(createdVideo.audioDuration)}</span>
                  )}
                </span>
              </div>
              <div className="text-xs text-gray-500">Created {createdVideo.createdAt.toLocaleTimeString()}</div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                <Film className="h-4 w-4" />
                Video Details
              </h4>
              <div className="text-sm text-green-800 space-y-1">
                <div>
                  <strong>Format:</strong> {createdVideo.aspectRatio.name} ({createdVideo.aspectRatio.ratio})
                </div>
                <div>
                  <strong>Platform:</strong> {createdVideo.aspectRatio.platform}
                </div>
                <div>
                  <strong>Resolution:</strong> {createdVideo.aspectRatio.width}×{createdVideo.aspectRatio.height}
                </div>
                <div>
                  <strong>Duration:</strong> {formatDuration(createdVideo.duration)}
                </div>
                <div>
                  <strong>Segments:</strong> {createdVideo.chunks.length}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => handleDownloadVideo(createdVideo)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <Download className="mr-2 h-5 w-5" />
                Download {createdVideo.aspectRatio.ratio} MP4
              </Button>

              {onCreateAnother && (
                <Button
                  onClick={onCreateAnother}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  size="lg"
                >
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Create Another Video
                </Button>
              )}
            </div>

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h5 className="font-semibold text-blue-900 mb-2">Next Steps</h5>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Your video is ready for {createdVideo.aspectRatio.platform}</li>
                <li>• Add voiceover, music, or captions as needed</li>
                <li>• Share directly to social media platforms</li>
                <li>• Create variations with different aspect ratios</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Original clip preview logic for when no final video is created yet
  if (!clips || clips.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-medium">Video Preview</h3>
        <div className="relative rounded-lg overflow-hidden bg-background aspect-video flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Film className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">Videos Ready!</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Your videos have been found and are ready to preview.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const playableClips = clips.filter((clip) => clip.url)

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium">Video Preview</h3>

      {selectedClip && selectedClip.url ? (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video
              src={selectedClip.url}
              className="w-full h-full"
              controls
              preload="metadata"
              poster={selectedClip.thumbnail}
            >
              Your browser does not support the video tag.
            </video>
          </div>

          <div className="text-sm space-y-1">
            <p className="font-medium">Keyword: "{selectedClip.keyword}"</p>
            {selectedClip.pexelsVideo && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>by {selectedClip.pexelsVideo.user.name}</span>
                <span>•</span>
                <span>{selectedClip.pexelsVideo.duration}s</span>
                <Link
                  href={selectedClip.pexelsVideo.url}
                  target="_blank"
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  View on Pexels <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => setSelectedClip(null)} className="w-full">
            Back to Videos
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-center p-3 bg-background rounded-lg">
            <p className="text-sm text-muted-foreground">
              {playableClips.length} of {clips.length} videos available
            </p>
          </div>

          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {clips.map((clip, index) => (
              <div
                key={clip.id}
                className={`flex gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                  clip.url ? "hover:bg-background" : "opacity-60"
                }`}
                onClick={() => clip.url && setSelectedClip(clip)}
              >
                <div className="w-12 h-8 bg-muted rounded overflow-hidden flex-shrink-0">
                  {clip.thumbnail && clip.url ? (
                    <img
                      src={clip.thumbnail || "/placeholder.svg"}
                      alt={`Video for ${clip.keyword}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-xs">
                  <p className="font-medium line-clamp-1">"{clip.keyword}"</p>
                  <p className="text-muted-foreground">{clip.url ? "Ready to preview" : "Not found"}</p>
                  {clip.url && (
                    <div className="flex items-center gap-1 text-primary mt-1">
                      <Play className="h-2 w-2" />
                      Click to play
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
