"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowRight,
  Search,
  Film,
  ExternalLink,
  AlertCircle,
  Archive,
  Download,
  Edit3,
  Clock,
  Sparkles,
  Music,
  Zap,
  List,
  FileText,
  Video,
  Play,
  RefreshCw,
  Mic,
  Upload,
  Volume2,
  RotateCcw,
  Loader2,
  Info,
  AudioWaveformIcon as Waveform,
} from "lucide-react"
import VideoPreview from "@/components/video-preview"
import VideoCreator from "@/components/video-creator"
import { segmentScriptByNaturalRhythm, searchVideosForSegments } from "@/app/actions"
import { AudioAnalyzer } from "@/lib/audio-analyzer"
import type { VideoChunk, ProcessedVideo } from "@/lib/video-processor"
import type { AudioAnalysisResult } from "@/lib/audio-analyzer"

export default function Home() {
  const [script, setScript] = useState("")
  const [keywords, setKeywords] = useState("")
  const [inputMode, setInputMode] = useState<"script" | "keywords" | "audio">("script")
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false)
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResult | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isCreatingVideo, setIsCreatingVideo] = useState(false)
  const [segmentData, setSegmentData] = useState<any>(null)
  const [editingKeywords, setEditingKeywords] = useState(false)
  const [videoData, setVideoData] = useState<any>(null)
  const [videoChunks, setVideoChunks] = useState<VideoChunk[]>([])
  const [createdVideo, setCreatedVideo] = useState<ProcessedVideo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1) // 1: input, 2: segments, 3: videos, 4: video creation

  const audioRef = useRef<HTMLAudioElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null)

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith("audio/")) {
        setError("Please upload a valid audio file (MP3, WAV, M4A, etc.)")
        return
      }

      // Validate file size (25MB limit)
      if (file.size > 25 * 1024 * 1024) {
        setError("File too large. Please upload a file smaller than 25MB.")
        return
      }

      setAudioFile(file)
      setError(null)
      setAudioAnalysis(null)

      // Create URL for audio playback
      const url = URL.createObjectURL(file)
      setAudioUrl(url)

      // Clear previous analysis
      setScript("")
    }
  }

  const handleAnalyzeAudio = async () => {
    if (!audioFile) return

    setIsAnalyzingAudio(true)
    setError(null)

    try {
      console.log("Starting audio analysis for:", audioFile.name)

      // Initialize audio analyzer
      if (!audioAnalyzerRef.current) {
        audioAnalyzerRef.current = new AudioAnalyzer()
      }

      // Analyze the audio file
      const analysis = await audioAnalyzerRef.current.analyzeAudio(audioFile)
      setAudioAnalysis(analysis)

      // Show success message
      setError(
        `✓ Audio analyzed successfully! Duration: ${analysis.totalDuration.toFixed(1)}s, Speech: ${(analysis.speechRatio * 100).toFixed(1)}%`,
      )

      console.log("Audio analysis complete:", analysis)
    } catch (error) {
      console.error("Error analyzing audio:", error)
      setError(
        `Failed to analyze audio: ${error instanceof Error ? error.message : "Unknown error"}\n\nYou can still use the audio - we'll match the video length to the full audio duration.`,
      )
    } finally {
      setIsAnalyzingAudio(false)
    }
  }

  const handlePlayPauseAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  const handleClearAudio = () => {
    setAudioFile(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setAudioAnalysis(null)
    setScript("")
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    if (audioAnalyzerRef.current) {
      audioAnalyzerRef.current.cleanup()
      audioAnalyzerRef.current = null
    }
  }

  const handleProcessScript = async (e: React.FormEvent) => {
    e.preventDefault()
    const textToProcess = script.trim()
    if (!textToProcess && inputMode !== "audio") return

    setIsProcessing(true)
    setError(null)

    try {
      if (inputMode === "audio" && audioFile && audioAnalysis) {
        // Audio mode with analysis - create segments based on audio timing
        console.log("Processing audio with analysis - creating segments to match full audio duration")

        // Extract keywords from any provided script text, or use generic keywords
        let keywords: string[] = []
        if (textToProcess) {
          // Use AI to extract keywords from script
          const result = await segmentScriptByNaturalRhythm(textToProcess)
          if (result.success && result.segments) {
            keywords = result.segments.map((seg: any) => seg.keyword)
          }
        }

        // If no keywords from script, generate generic visual keywords
        if (keywords.length === 0) {
          keywords = [
            "business meeting",
            "technology",
            "success",
            "teamwork",
            "innovation",
            "growth",
            "planning",
            "achievement",
            "collaboration",
            "progress",
            "creativity",
            "leadership",
            "strategy",
            "development",
            "motivation",
          ]
        }

        // Create video segments that match the full audio duration
        const audioSegments = audioAnalyzerRef.current!.createVideoSegments(keywords, audioAnalysis, 6)

        // Convert to our segment format
        const enhancedSegments = audioSegments.map((audioSeg, index) => ({
          id: index + 1,
          text: audioSeg.text,
          startTime: audioSeg.startTime,
          endTime: audioSeg.endTime,
          duration: audioSeg.duration,
          keyword: audioSeg.keyword,
          audioSegmentType: audioSeg.audioSegmentType,
        }))

        setSegmentData({
          success: true,
          segments: enhancedSegments,
          segmentCount: enhancedSegments.length,
          totalDuration: audioAnalysis.totalDuration,
          hasAudio: true,
          audioFile: audioFile,
          audioAnalysis: audioAnalysis,
          usingAudioAnalysis: true,
        })
        setStep(2)
      } else if (inputMode === "audio" && audioFile) {
        // Audio mode without analysis - estimate duration and create segments
        console.log("Processing audio without analysis - estimating duration")

        const estimatedDuration = ((audioFile.size / 1024 / 1024) * 8) / 128 // Rough estimate
        const segmentDuration = 6
        const numSegments = Math.ceil(estimatedDuration / segmentDuration)

        // Generate keywords
        let keywords: string[] = []
        if (textToProcess) {
          const result = await segmentScriptByNaturalRhythm(textToProcess)
          if (result.success && result.segments) {
            keywords = result.segments.map((seg: any) => seg.keyword)
          }
        }

        if (keywords.length === 0) {
          keywords = [
            "business meeting",
            "technology",
            "success",
            "teamwork",
            "innovation",
            "growth",
            "planning",
            "achievement",
            "collaboration",
            "progress",
          ]
        }

        // Create segments to match estimated audio duration
        const segments = []
        let currentTime = 0
        for (let i = 0; i < numSegments; i++) {
          const duration = Math.min(segmentDuration, estimatedDuration - currentTime)
          const keyword = keywords[i % keywords.length]

          segments.push({
            id: i + 1,
            text: `Video segment for: ${keyword}`,
            startTime: Math.round(currentTime * 10) / 10,
            endTime: Math.round((currentTime + duration) * 10) / 10,
            duration: Math.round(duration * 10) / 10,
            keyword: keyword,
          })

          currentTime += duration
          if (currentTime >= estimatedDuration) break
        }

        setSegmentData({
          success: true,
          segments: segments,
          segmentCount: segments.length,
          totalDuration: estimatedDuration,
          hasAudio: true,
          audioFile: audioFile,
          usingAudioAnalysis: false,
        })
        setStep(2)
      } else {
        // Script or keyword mode
        const result = await segmentScriptByNaturalRhythm(textToProcess)

        if (result.success) {
          setSegmentData({
            ...result,
            hasAudio: false,
          })
          setStep(2)

          if (result.error) {
            setError(result.error)
          }
        } else {
          setError(result.error || "Failed to process script")
        }
      }
    } catch (error) {
      console.error("Error processing:", error)
      setError(`An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleProcessKeywords = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keywords.trim()) return

    setIsProcessing(true)
    setError(null)

    try {
      // Parse comma-separated keywords
      const keywordList = keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0)

      if (keywordList.length === 0) {
        throw new Error("No valid keywords found")
      }

      // Create segments with 6-second duration each for keywords
      const segments = keywordList.map((keyword, index) => ({
        id: `segment-${index + 1}`,
        text: keyword,
        startTime: index * 6,
        endTime: (index + 1) * 6,
        duration: 6,
        keyword: keyword,
      }))

      setSegmentData({
        success: true,
        segments: segments,
        totalDuration: segments.length * 6,
        segmentCount: segments.length,
        usingFallback: false,
      })

      setStep(2)
    } catch (error) {
      console.error("Error processing keywords:", error)
      setError(`An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSearchVideos = async () => {
    if (!segmentData?.segments) return

    setIsSearching(true)
    setError(null)

    try {
      const result = await searchVideosForSegments(segmentData.segments)

      if (result.success) {
        setVideoData(result)

        // Convert to video chunks for video creation with better validation
        const chunks: VideoChunk[] = result.clips
          .filter((clip: any) => {
            // More strict validation
            const hasValidUrl = clip.url && typeof clip.url === "string" && clip.url.startsWith("http")
            const hasKeyword = clip.keyword && clip.keyword.trim().length > 0
            const hasText = clip.text && clip.text.trim().length > 0

            if (!hasValidUrl) {
              console.warn(`Clip ${clip.id} has invalid URL:`, clip.url)
            }

            return hasValidUrl && hasKeyword && hasText
          })
          .map((clip: any) => ({
            id: clip.id,
            keyword: clip.keyword.trim(),
            text: clip.text.trim(),
            duration: Math.max(clip.endTime - clip.startTime, 2),
            videoUrl: clip.url,
            startTime: clip.startTime || 0,
            endTime: clip.endTime || clip.startTime + Math.max(clip.endTime - clip.startTime, 2),
          }))

        console.log(`Created ${chunks.length} valid video chunks from ${result.clips.length} clips`)

        if (chunks.length === 0) {
          setError(
            "No valid videos found for creating a complete video. Please try different keywords or recreate the segments.",
          )
          setVideoData(result)
          setStep(3)
          return
        }

        setVideoChunks(chunks)
        setStep(3)

        if (chunks.length < result.clips.length) {
          setError(
            `Note: ${chunks.length} of ${result.clips.length} videos are valid for video creation. Invalid videos will be skipped.`,
          )
        }
      } else {
        setError(result.error || "Failed to search for videos")
      }
    } catch (error) {
      console.error("Error searching videos:", error)
      setError("An unexpected error occurred while searching for videos.")
    } finally {
      setIsSearching(false)
    }
  }

  const handleCreateVideo = () => {
    if (videoChunks.length > 0) {
      setStep(4)
    }
  }

  const handleDownloadAll = async () => {
    if (!videoData?.clips) return

    const validClips = videoData.clips.filter((clip: any) => clip.downloadUrl)

    if (validClips.length === 0) {
      setError("No videos available for download")
      return
    }

    setIsDownloading(true)
    setError(null)

    try {
      const response = await fetch("/api/download-videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clips: validClips,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to download videos")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `video-collection-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()

      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setError("Download completed successfully!")
    } catch (error) {
      console.error("Error downloading videos:", error)
      setError(error instanceof Error ? error.message : "Failed to download videos")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleUpdateKeyword = (segmentId: number, newKeyword: string) => {
    if (segmentData?.segments) {
      const updatedSegments = segmentData.segments.map((segment: any) =>
        segment.id === segmentId ? { ...segment, keyword: newKeyword } : segment,
      )
      setSegmentData({
        ...segmentData,
        segments: updatedSegments,
      })
    }
  }

  const handleStartOver = () => {
    setScript("")
    setKeywords("")
    setAudioFile(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setAudioAnalysis(null)
    setSegmentData(null)
    setVideoData(null)
    setVideoChunks([])
    setCreatedVideo(null)
    setError(null)
    setStep(1)
    setEditingKeywords(false)
    setIsCreatingVideo(false)
    setIsPlaying(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    if (audioAnalyzerRef.current) {
      audioAnalyzerRef.current.cleanup()
      audioAnalyzerRef.current = null
    }
  }

  const handleVideoCreated = (video: ProcessedVideo) => {
    setCreatedVideo(video)
  }

  const handleVideoCreating = (isCreating: boolean) => {
    setIsCreatingVideo(isCreating)
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "Excellent":
        return "bg-green-100 text-green-800 border-green-300"
      case "Good":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "Fair":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const formatTime = (seconds: number) => {
    const roundedSeconds = Math.round(seconds * 10) / 10 // Round to 1 decimal place
    const mins = Math.floor(roundedSeconds / 60)
    const secs = roundedSeconds % 60
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`
  }

  const handleChangeVideo = async (segmentId: number, keyword: string) => {
    if (!segmentData?.segments) return

    setIsSearching(true)
    setError(null)

    try {
      // Find the specific segment
      const segment = segmentData.segments.find((s: any) => s.id === segmentId)
      if (!segment) return

      // Search for new videos for this segment
      const result = await searchVideosForSegments([segment])

      if (result.success && result.clips.length > 0) {
        const newClip = result.clips[0]

        // Update the videoData with the new clip
        setVideoData((prev: any) => ({
          ...prev,
          clips: prev.clips.map((clip: any) => (clip.segmentId === segmentId ? newClip : clip)),
          foundCount: prev.clips.filter((c: any) => (c.segmentId === segmentId ? newClip.url : c.url)).length,
        }))

        // Update videoChunks as well
        setVideoChunks((prev) =>
          prev.map((chunk) =>
            chunk.id === newClip.id
              ? {
                  ...chunk,
                  videoUrl: newClip.url || chunk.videoUrl,
                }
              : chunk,
          ),
        )
      }
    } catch (error) {
      console.error("Error changing video:", error)
      setError("Failed to find alternative video for this segment.")
    } finally {
      setIsSearching(false)
    }
  }

  const handleRefreshAllVideos = async (): Promise<void> => {
    if (!segmentData?.segments) return

    setIsSearching(true)
    setError(null)

    try {
      // Force a new search for all segments
      const result = await searchVideosForSegments(segmentData.segments)

      if (result.success) {
        // Update the video data state
        setVideoData(result)

        // Create new video chunks with the fresh videos
        const chunks: VideoChunk[] = result.clips
          .filter((clip: any) => {
            const hasValidUrl = clip.url && typeof clip.url === "string" && clip.url.startsWith("http")
            return hasValidUrl
          })
          .map((clip: any) => ({
            id: clip.id,
            keyword: clip.keyword.trim(),
            text: clip.text.trim(),
            duration: Math.max(clip.endTime - clip.startTime, 2),
            videoUrl: clip.url,
            startTime: clip.startTime || 0,
            endTime: clip.endTime || clip.startTime + Math.max(clip.endTime - clip.startTime, 2),
          }))

        // Update the video chunks state with the new videos
        setVideoChunks(chunks)

        console.log(`Refreshed and updated ${chunks.length} video chunks with new videos`)

        // Return success
        return Promise.resolve()
      } else {
        throw new Error(result.error || "Failed to refresh videos")
      }
    } catch (error) {
      console.error("Error refreshing videos:", error)
      setError("Failed to find new videos. Please try again.")
      return Promise.reject(error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <header className="border-b border-blue-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2 font-bold text-2xl">
            <span className="text-blue-600">Script</span>
            <span className="text-blue-800">2</span>
            <span className="text-blue-600">Video</span>
          </div>
          <nav className="hidden md:flex gap-8">
            <a href="#home" className="font-medium text-blue-900 hover:text-blue-600 transition-colors">
              Home
            </a>
            <a href="#features" className="font-medium text-blue-700 hover:text-blue-600 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="font-medium text-blue-700 hover:text-blue-600 transition-colors">
              How It Works
            </a>
            <a href="#create" className="font-medium text-blue-700 hover:text-blue-600 transition-colors">
              Create
            </a>
          </nav>
          <div>
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6">
              <a href="#create">Get Started</a>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1" style={{ scrollBehavior: "smooth" }}>
        <section id="home" className="py-16 md:py-24 lg:py-32">
          <div className="container px-6 md:px-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="space-y-6">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-blue-900">
                  Transform Scripts Into Complete Videos
                </h1>
                <p className="text-blue-700 text-xl md:text-2xl leading-relaxed">
                  Extract keywords, find matching stock videos, and automatically create complete videos ready for
                  TikTok, Instagram, or further editing.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    asChild
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4"
                  >
                    <a href="#create">
                      Start Creating <ArrowRight className="ml-2 h-5 w-5" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    asChild
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold px-8 py-4"
                  >
                    <a href="#how-it-works">See How It Works</a>
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden bg-white border-2 border-blue-200 shadow-xl">
                <div className="w-full aspect-video flex items-center justify-center p-8">
                  <div className="text-center space-y-6">
                    <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                      <Video className="h-12 w-12 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-blue-900">Complete Video Creation</h3>
                      <p className="text-blue-700 mt-2">From script to finished video in minutes</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-16 md:py-24 lg:py-32 bg-white">
          <div className="container px-6 md:px-8">
            <div className="flex flex-col items-center justify-center space-y-6 text-center mb-16">
              <div className="space-y-4">
                <div className="inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800">
                  Key Features
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-5xl text-blue-900">Powerful Video Creation</h2>
                <p className="max-w-3xl text-blue-700 text-xl leading-relaxed">
                  Everything you need to transform scripts into professional videos automatically.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-4 lg:gap-12">
              <div className="text-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mx-auto">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-blue-900">AI-Powered Analysis</h3>
                <p className="text-blue-700">
                  Advanced AI analyzes your script and extracts precise visual keywords for each segment.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mx-auto">
                  <Waveform className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-blue-900">Audio Analysis</h3>
                <p className="text-blue-700">
                  Analyzes audio files to detect speech and silence, creating videos that match your full audio length.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mx-auto">
                  <Film className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-blue-900">Auto Video Creation</h3>
                <p className="text-blue-700">
                  Automatically stitches video segments together into one complete, ready-to-use video.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mx-auto">
                  <Download className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-blue-900">Instant Download</h3>
                <p className="text-blue-700">
                  Download your finished video as MP4, perfect for TikTok, Instagram, or further editing.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-16 md:py-24 lg:py-32 bg-gradient-to-br from-blue-50 to-purple-50">
          <div className="container px-6 md:px-8">
            <div className="flex flex-col items-center justify-center space-y-6 text-center mb-16">
              <div className="space-y-4">
                <div className="inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800">
                  Simple Process
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-5xl text-blue-900">How It Works</h2>
                <p className="max-w-3xl text-blue-700 text-xl leading-relaxed">
                  Get your complete video in just four simple steps.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-4 lg:gap-12">
              <div className="text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white mx-auto">
                  1
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mx-auto">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-blue-900">Enter Content</h3>
                <p className="text-blue-700">
                  Upload audio, enter script, or provide keywords. Audio analysis creates videos matching full duration.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white mx-auto">
                  2
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mx-auto">
                  <Search className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-blue-900">Find Videos</h3>
                <p className="text-blue-700">
                  AI extracts keywords and searches for diverse stock footage, randomizing selections for variety.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white mx-auto">
                  3
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mx-auto">
                  <Film className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-blue-900">Create Video</h3>
                <p className="text-blue-700">
                  Videos are automatically cut to match timing and stitched together with synchronized audio.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white mx-auto">
                  4
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mx-auto">
                  <Download className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-blue-900">Download & Share</h3>
                <p className="text-blue-700">
                  Download your finished MP4 video with synchronized audio, ready for any platform.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="create" className="py-16 md:py-24 lg:py-32 bg-white">
          <div className="container px-6 md:px-8">
            <div className="flex flex-col items-center justify-center space-y-6 text-center mb-16">
              <div className="space-y-4">
                <div className="inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800">
                  Get Started
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-5xl text-blue-900">
                  Create Your Complete Video
                </h2>
                <p className="max-w-3xl text-blue-700 text-xl leading-relaxed">
                  Transform your script or audio into a professional video ready for social media in minutes.
                </p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                {/* AI Status */}
                <Card className="border-2 border-green-200 shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-green-600" />
                      <span className="text-green-800 font-medium">AI-Powered Video Creation Ready</span>
                      <Badge className="bg-green-100 text-green-800 border border-green-300">Groq AI</Badge>
                      <Badge className="bg-purple-100 text-purple-800 border border-purple-300">Audio Analysis</Badge>
                    </div>
                  </CardContent>
                </Card>

                {error && (
                  <Alert
                    className={`border-2 ${
                      error.includes("✓") || error.includes("completed successfully")
                        ? "border-green-200 bg-green-50"
                        : error.includes("Note:") || error.includes("completed successfully")
                          ? "border-blue-200 bg-blue-50"
                          : error.includes("fallback") || error.includes("enhanced AI")
                            ? "border-yellow-200 bg-yellow-50"
                            : "border-red-200 bg-red-50"
                    }`}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription
                      className={
                        error.includes("✓")
                          ? "text-green-800"
                          : error.includes("completed successfully")
                            ? "text-blue-800"
                            : error.includes("fallback") || error.includes("enhanced AI")
                              ? "text-yellow-800"
                              : ""
                      }
                      style={{ whiteSpace: "pre-line" }}
                    >
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                {step === 1 && (
                  <Card className="border-2 border-blue-200 shadow-lg">
                    <CardHeader className="bg-blue-50">
                      <CardTitle className="text-blue-900 flex items-center gap-2">
                        <Music className="h-5 w-5" />
                        Step 1: Enter Your Content
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="flex gap-4 mb-6">
                        <Button
                          variant={inputMode === "script" ? "default" : "outline"}
                          onClick={() => setInputMode("script")}
                          className={inputMode === "script" ? "bg-blue-600" : "border-blue-300 text-blue-700"}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Script
                        </Button>
                        <Button
                          variant={inputMode === "keywords" ? "default" : "outline"}
                          onClick={() => setInputMode("keywords")}
                          className={inputMode === "keywords" ? "bg-blue-600" : "border-blue-300 text-blue-700"}
                        >
                          <List className="h-4 w-4 mr-2" />
                          Keywords
                        </Button>
                        <Button
                          variant={inputMode === "audio" ? "default" : "outline"}
                          onClick={() => setInputMode("audio")}
                          className={inputMode === "audio" ? "bg-blue-600" : "border-blue-300 text-blue-700"}
                        >
                          <Mic className="h-4 w-4 mr-2" />
                          Audio
                        </Button>
                      </div>

                      {inputMode === "script" ? (
                        <form onSubmit={handleProcessScript} className="space-y-6">
                          <div className="space-y-3">
                            <label htmlFor="script" className="text-sm font-semibold text-blue-900">
                              Your Script
                            </label>
                            <Textarea
                              id="script"
                              placeholder="Enter your script here. We'll break it into 5-7 second segments and create a complete video..."
                              className="min-h-[200px] border-2 border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                              value={script}
                              onChange={(e) => setScript(e.target.value)}
                              disabled={isProcessing}
                            />
                          </div>

                          {script.trim() && (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="text-sm text-blue-700">
                                <strong>Word count:</strong> {script.trim().split(/\s+/).length} words
                              </div>
                              <div className="text-xs text-blue-600 mt-1">
                                Estimated video duration: ~{Math.ceil((script.trim().split(/\s+/).length / 150) * 60)}s
                              </div>
                            </div>
                          )}

                          <Button
                            type="submit"
                            disabled={isProcessing || !script.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
                            size="lg"
                          >
                            {isProcessing ? (
                              <>
                                <Clock className="mr-2 h-5 w-5 animate-pulse" />
                                Processing script...
                              </>
                            ) : (
                              <>
                                <Video className="mr-2 h-5 w-5" />
                                Create Video Segments
                              </>
                            )}
                          </Button>
                        </form>
                      ) : inputMode === "keywords" ? (
                        <form onSubmit={handleProcessKeywords} className="space-y-6">
                          <div className="space-y-3">
                            <label htmlFor="keywords" className="text-sm font-semibold text-blue-900">
                              Your Keywords (comma-separated)
                            </label>
                            <Textarea
                              id="keywords"
                              placeholder="Enter keywords separated by commas: dream, breaking, testing, success..."
                              className="min-h-[200px] border-2 border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                              value={keywords}
                              onChange={(e) => setKeywords(e.target.value)}
                              disabled={isProcessing}
                            />
                          </div>

                          {keywords.trim() && (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="text-sm text-blue-700">
                                <strong>Keywords:</strong>{" "}
                                {
                                  keywords
                                    .split(",")
                                    .map((k) => k.trim())
                                    .filter((k) => k.length > 0).length
                                }
                              </div>
                              <div className="text-xs text-blue-600 mt-1">
                                Estimated video duration: ~{keywords.split(",").filter((k) => k.trim()).length * 6}s
                              </div>
                            </div>
                          )}

                          <Button
                            type="submit"
                            disabled={isProcessing || !keywords.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
                            size="lg"
                          >
                            {isProcessing ? (
                              <>
                                <Clock className="mr-2 h-5 w-5 animate-pulse" />
                                Processing keywords...
                              </>
                            ) : (
                              <>
                                <Video className="mr-2 h-5 w-5" />
                                Create Video From Keywords
                              </>
                            )}
                          </Button>
                        </form>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <label htmlFor="audio-upload" className="text-sm font-semibold text-blue-900">
                              Upload Audio File (MP3, WAV, M4A, etc.)
                            </label>
                            <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center">
                              <input
                                ref={fileInputRef}
                                id="audio-upload"
                                type="file"
                                accept="audio/*"
                                onChange={handleAudioUpload}
                                className="hidden"
                              />
                              <label htmlFor="audio-upload" className="cursor-pointer flex flex-col items-center gap-3">
                                <Upload className="h-12 w-12 text-blue-400" />
                                <div>
                                  <p className="text-blue-900 font-medium">Click to upload audio file</p>
                                  <p className="text-blue-600 text-sm">MP3, WAV, M4A, and other audio formats</p>
                                  <p className="text-blue-500 text-xs mt-1">Maximum file size: 25MB</p>
                                </div>
                              </label>
                            </div>
                          </div>

                          {audioFile && (
                            <div className="space-y-4">
                              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center gap-3">
                                  <Volume2 className="h-5 w-5 text-green-600" />
                                  <div className="flex-1">
                                    <p className="text-green-900 font-medium">{audioFile.name}</p>
                                    <p className="text-green-700 text-sm">
                                      {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • {audioFile.type}
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearAudio}
                                    className="border-red-300 text-red-700 hover:bg-red-50"
                                  >
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                    Clear
                                  </Button>
                                </div>
                              </div>

                              {audioUrl && (
                                <div className="space-y-3">
                                  <audio
                                    ref={audioRef}
                                    src={audioUrl}
                                    className="w-full"
                                    controls
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    onEnded={() => setIsPlaying(false)}
                                  />

                                  <Button
                                    onClick={handleAnalyzeAudio}
                                    disabled={isAnalyzingAudio}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                    size="lg"
                                  >
                                    {isAnalyzingAudio ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Analyzing audio patterns...
                                      </>
                                    ) : (
                                      <>
                                        <Waveform className="mr-2 h-4 w-4" />
                                        Analyze Audio (Recommended)
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}

                              {audioAnalysis && (
                                <div className="space-y-3">
                                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                    <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                                      <Waveform className="h-4 w-4" />
                                      Audio Analysis Results
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <div className="text-purple-700">
                                          <strong>Total Duration:</strong> {formatTime(audioAnalysis.totalDuration)}
                                        </div>
                                        <div className="text-purple-700">
                                          <strong>Speech Segments:</strong> {audioAnalysis.speechSegments.length}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-purple-700">
                                          <strong>Speech Ratio:</strong> {(audioAnalysis.speechRatio * 100).toFixed(1)}%
                                        </div>
                                        <div className="text-purple-700">
                                          <strong>Silence Segments:</strong> {audioAnalysis.silenceSegments.length}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <label className="text-sm font-semibold text-blue-900">
                                      Optional: Add Script for Better Keywords
                                    </label>
                                    <Textarea
                                      value={script}
                                      onChange={(e) => setScript(e.target.value)}
                                      className="min-h-[100px] border-2 border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                                      placeholder="Optional: Enter script text to generate better visual keywords..."
                                    />
                                    <div className="text-xs text-blue-600">
                                      Leave empty to use generic visual keywords. Video will match full audio duration.
                                    </div>
                                  </div>
                                </div>
                              )}

                              {(audioAnalysis || audioFile) && (
                                <form onSubmit={handleProcessScript}>
                                  <Button
                                    type="submit"
                                    disabled={isProcessing}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
                                    size="lg"
                                  >
                                    {isProcessing ? (
                                      <>
                                        <Clock className="mr-2 h-5 w-5 animate-pulse" />
                                        Creating audio-synced segments...
                                      </>
                                    ) : (
                                      <>
                                        <Video className="mr-2 h-5 w-5" />
                                        Create Video Matching Audio Length
                                      </>
                                    )}
                                  </Button>
                                </form>
                              )}
                            </div>
                          )}

                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              Enhanced Audio Processing
                            </h4>
                            <ul className="text-sm text-blue-700 space-y-1">
                              <li>• Upload your audio file (MP3, WAV, M4A, etc.)</li>
                              <li>• Click "Analyze Audio" to detect speech and silence patterns</li>
                              <li>• Video segments will be created to match your full audio duration</li>
                              <li>• Optionally add script text for better visual keywords</li>
                              <li>• Your original audio will be synchronized with the final video</li>
                              <li>• All found videos will be automatically muted</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {step === 2 && segmentData && (
                  <Card className="border-2 border-blue-200 shadow-lg">
                    <CardHeader className="bg-blue-50">
                      <CardTitle className="text-blue-900 flex items-center gap-2">
                        <List className="h-5 w-5" />
                        Step 2: Review Video Segments
                        {segmentData.hasAudio && (
                          <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
                            <Volume2 className="h-3 w-3 mr-1" />
                            Audio-Synced
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                          <div className="text-lg font-bold text-blue-900">{segmentData.segmentCount}</div>
                          <div className="text-xs text-blue-700">Segments</div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                          <div className="text-lg font-bold text-blue-900">{formatTime(segmentData.totalDuration)}</div>
                          <div className="text-xs text-blue-700">Duration</div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                          <div className="text-lg font-bold text-blue-900">
                            {segmentData.hasAudio ? "Audio-Synced" : "5-7s"}
                          </div>
                          <div className="text-xs text-blue-700">Per Segment</div>
                        </div>
                      </div>

                      {segmentData.hasAudio && segmentData.audioAnalysis && (
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 flex items-start gap-3">
                          <Waveform className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-purple-700">
                            <strong>Audio-Synchronized Video</strong>
                            <p className="mt-1">
                              Video segments created to match your full audio duration (
                              {formatTime(segmentData.audioAnalysis.totalDuration)}). Speech and silence patterns
                              analyzed for optimal timing.
                            </p>
                            <div className="mt-2 text-xs">
                              Speech: {(segmentData.audioAnalysis.speechRatio * 100).toFixed(1)}% • Segments:{" "}
                              {segmentData.audioAnalysis.speechSegments.length} speech,{" "}
                              {segmentData.audioAnalysis.silenceSegments.length} silence
                            </div>
                          </div>
                        </div>
                      )}

                      {segmentData.hasAudio && !segmentData.audioAnalysis && (
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 flex items-start gap-3">
                          <Volume2 className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-yellow-700">
                            <strong>Audio-Enhanced Video (Estimated)</strong>
                            <p className="mt-1">
                              Video segments created to match estimated audio duration. Your original audio will be
                              synchronized with the video segments.
                            </p>
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-blue-900">Video Segments</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingKeywords(!editingKeywords)}
                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            {editingKeywords ? "Done Editing" : "Edit Keywords"}
                          </Button>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {segmentData.segments?.map((segment: any) => (
                            <div key={segment.id} className="p-4 bg-white rounded-lg border border-blue-200">
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0">
                                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-sm font-bold text-blue-900">{segment.id}</span>
                                  </div>
                                </div>

                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-blue-100 text-blue-800 border border-blue-300 text-xs">
                                      {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                                    </Badge>
                                    <span className="text-xs text-blue-600">{formatTime(segment.duration)}</span>
                                    {segment.audioSegmentType && (
                                      <Badge
                                        className={`text-xs ${
                                          segment.audioSegmentType === "speech"
                                            ? "bg-green-100 text-green-800 border-green-300"
                                            : segment.audioSegmentType === "silence"
                                              ? "bg-gray-100 text-gray-800 border-gray-300"
                                              : "bg-yellow-100 text-yellow-800 border-yellow-300"
                                        }`}
                                      >
                                        {segment.audioSegmentType}
                                      </Badge>
                                    )}
                                  </div>

                                  <p className="text-sm text-blue-900 font-medium">"{segment.text}"</p>

                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-blue-700">Visual Keyword:</span>
                                    {editingKeywords ? (
                                      <Input
                                        value={segment.keyword}
                                        onChange={(e) => handleUpdateKeyword(segment.id, e.target.value)}
                                        className="text-xs h-7 border-blue-300 focus:border-blue-500 flex-1"
                                        placeholder="concrete visual keyword"
                                      />
                                    ) : (
                                      <Badge className="bg-green-100 text-green-800 border border-green-300 text-xs">
                                        {segment.keyword}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={handleSearchVideos}
                          disabled={isSearching || !segmentData.segments?.length}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
                          size="lg"
                        >
                          {isSearching ? (
                            <>
                              <Search className="mr-2 h-5 w-5 animate-pulse" />
                              Searching {segmentData.segmentCount} videos...
                            </>
                          ) : (
                            <>
                              <Film className="mr-2 h-5 w-5" />
                              Find Videos ({segmentData.segmentCount} segments)
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setStep(1)}
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          Back
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {step === 3 && videoData && (
                  <Card className="border-2 border-blue-200 shadow-lg">
                    <CardHeader className="bg-blue-50">
                      <CardTitle className="text-blue-900 flex items-center gap-2">
                        <Film className="h-5 w-5" />
                        Step 3: Video Collection Ready
                        {segmentData?.hasAudio && (
                          <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
                            <Volume2 className="h-3 w-3 mr-1" />
                            Audio Ready
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
                          <div className="text-2xl font-bold text-blue-900">{videoData.foundCount}</div>
                          <div className="text-sm text-blue-700">Videos Found</div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
                          <div className="text-2xl font-bold text-blue-900">
                            {formatTime(
                              Math.round(
                                videoData.segments.reduce((acc: number, segment: any) => acc + segment.duration, 0) *
                                  10,
                              ) / 10,
                            )}
                          </div>
                          <div className="text-sm text-blue-700">Total Duration</div>
                        </div>
                      </div>

                      {segmentData?.hasAudio ? (
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 flex items-start gap-3">
                          <Volume2 className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-purple-700">
                            <strong>Audio + Video Creation Ready</strong>
                            <p className="mt-1">
                              Your original audio will be synchronized with the video segments. All videos will be
                              automatically muted and your audio will be the primary soundtrack.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200 flex items-start gap-3">
                          <Video className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-green-700">
                            <strong>Ready for Video Creation</strong>
                            <p className="mt-1">
                              All videos will be automatically cut to match your script timing and stitched together
                              into one complete video.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="max-h-96 overflow-y-auto space-y-3 border border-blue-200 rounded-lg p-4 bg-white">
                        {videoData.clips?.map((clip: any) => (
                          <div key={clip.id} className="flex gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mb-2">
                                <span className="text-xs font-bold text-white">{clip.segmentId}</span>
                              </div>
                              <div className="w-20 h-12 bg-white rounded overflow-hidden border border-blue-200">
                                {clip.thumbnail && clip.url ? (
                                  <img
                                    src={clip.thumbnail || "/placeholder.svg"}
                                    alt={`Video for ${clip.keyword}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Film className="h-4 w-4 text-blue-400" />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex-1 text-sm space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-blue-100 text-blue-800 border border-blue-300 text-xs">
                                  {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                                </Badge>
                                <Badge className="bg-green-100 text-green-800 border border-green-300 text-xs">
                                  {clip.keyword}
                                </Badge>
                                {segmentData?.hasAudio && (
                                  <Badge className="bg-purple-100 text-purple-800 border border-purple-300 text-xs">
                                    Muted
                                  </Badge>
                                )}
                              </div>

                              <p className="text-blue-900 font-medium">"{clip.text}"</p>

                              <div className="flex items-center gap-2">
                                {clip.quality && (
                                  <Badge className={`text-xs ${getQualityColor(clip.quality)}`}>{clip.quality}</Badge>
                                )}
                                {clip.duration && (
                                  <span className="text-xs text-blue-600">
                                    Will be cut to {formatTime(clip.endTime - clip.startTime)}
                                  </span>
                                )}
                                {clip.url ? (
                                  <span className="text-xs text-green-600">✓ Ready</span>
                                ) : (
                                  <span className="text-xs text-red-600">✗ Not found</span>
                                )}
                              </div>

                              {clip.pexelsVideo && (
                                <div className="flex items-center gap-2 text-xs text-blue-600">
                                  <span>by {clip.pexelsVideo.user.name}</span>
                                  <a
                                    href={clip.pexelsVideo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 hover:text-blue-800 transition-colors"
                                  >
                                    View on Pexels <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0 flex flex-col gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleChangeVideo(clip.segmentId, clip.keyword)}
                                className="border-orange-300 text-orange-700 hover:bg-orange-50 text-xs px-2 py-1"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Change
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          onClick={handleRefreshAllVideos}
                          disabled={isSearching}
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh All Videos
                        </Button>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={handleCreateVideo}
                          disabled={videoChunks.length === 0}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 text-lg font-semibold"
                          size="lg"
                        >
                          <Video className="mr-2 h-5 w-5" />
                          {segmentData?.hasAudio ? "Create Video with Audio" : "Create Complete Video"} (
                          {videoChunks.length} segments)
                        </Button>
                        <Button
                          onClick={handleDownloadAll}
                          disabled={videoData.foundCount === 0 || isDownloading}
                          variant="outline"
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                          size="lg"
                        >
                          {isDownloading ? (
                            <>
                              <Download className="mr-2 h-5 w-5 animate-pulse" />
                              Downloading...
                            </>
                          ) : (
                            <>
                              <Archive className="mr-2 h-5 w-5" />
                              Download ZIP
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {step === 4 && videoChunks.length > 0 && (
                  <VideoCreator
                    chunks={videoChunks}
                    audioFile={segmentData?.audioFile}
                    onVideoCreated={handleVideoCreated}
                    onVideoCreating={handleVideoCreating}
                    onRefreshVideos={async () => {
                      await handleRefreshAllVideos()
                    }}
                  />
                )}
              </div>

              <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200 p-6">
                {step === 1 && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
                      {inputMode === "script" ? (
                        <Video className="h-10 w-10 text-purple-600" />
                      ) : inputMode === "keywords" ? (
                        <List className="h-10 w-10 text-purple-600" />
                      ) : (
                        <Waveform className="h-10 w-10 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-blue-900 mb-2">
                        {inputMode === "script"
                          ? "Complete Video Creation"
                          : inputMode === "keywords"
                            ? "Keyword-Based Videos"
                            : "Audio-to-Video Creation"}
                      </h3>
                      <p className="text-blue-700">
                        {inputMode === "script"
                          ? "We'll create a complete video with perfect timing for your script."
                          : inputMode === "keywords"
                            ? "Create videos from your keywords with automatic timing."
                            : "Upload audio, analyze patterns, and create a synchronized video matching full duration."}
                      </p>
                    </div>

                    <div className="w-full max-w-md p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-2">What You'll Get</h4>
                      <div className="space-y-2 text-left text-sm text-blue-800">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            Perfect timing based on {inputMode === "audio" ? "audio analysis" : "reading speed"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Film className="h-4 w-4" />
                          <span>Automatically cut and stitched videos</span>
                        </div>
                        {inputMode === "audio" && (
                          <div className="flex items-center gap-2">
                            <Waveform className="h-4 w-4" />
                            <span>Speech/silence analysis for optimal timing</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          <span>Ready-to-use MP4 file</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Play className="h-4 w-4" />
                          <span>Perfect for TikTok, Instagram, etc.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && segmentData && (
                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-blue-900">Segment Preview</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-2">Video Timeline</h4>
                        <p className="text-sm text-blue-700">
                          {segmentData.segmentCount} segments • {formatTime(segmentData.totalDuration)} total duration
                          {segmentData.hasAudio && " • Audio-synced"}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold text-blue-900">Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {segmentData.segments?.slice(0, 6).map((segment: any, index: number) => (
                            <Badge key={index} className="bg-green-100 text-green-800 border border-green-300">
                              {segment.keyword}
                            </Badge>
                          ))}
                          {segmentData.segments?.length > 6 && (
                            <Badge className="bg-blue-200 text-blue-800">+{segmentData.segments.length - 6} more</Badge>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-xs text-blue-700 mb-1">Segment Durations</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {segmentData.segments?.slice(0, 8).map((segment: any, index: number) => (
                            <Badge key={index} className="bg-blue-100 text-blue-800 border border-blue-300">
                              {formatTime(segment.duration)}
                            </Badge>
                          ))}
                          {segmentData.segments?.length > 8 && (
                            <Badge className="bg-blue-200 text-blue-800">+{segmentData.segments.length - 8} more</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(step === 3 || step === 4) && (
                  <VideoPreview
                    clips={videoData?.clips}
                    createdVideo={createdVideo}
                    isCreatingVideo={isCreatingVideo}
                    onCreateAnother={handleStartOver}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-blue-200 py-8 md:py-12 bg-white">
        <div className="container flex flex-col items-center justify-center gap-6 md:flex-row md:gap-8 px-6">
          <p className="text-center text-sm leading-loose text-blue-700 md:text-left">
            © 2025 Script2Video. All rights reserved.
          </p>
          <nav className="flex gap-6 sm:gap-8">
            <a href="#" className="text-sm font-medium hover:underline text-blue-700 hover:text-blue-600">
              Terms
            </a>
            <a href="#" className="text-sm font-medium hover:underline text-blue-700 hover:text-blue-600">
              Privacy
            </a>
          </nav>
          <p className="text-center text-sm leading-loose text-blue-700">
            Made with ❤️ by{" "}
            <a
              href="https://www.linkedin.com/in/itsmebcash"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline hover:text-blue-600"
            >
              Bikash Sharma
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
