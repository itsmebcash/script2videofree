"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  Search,
  Film,
  ExternalLink,
  AlertCircle,
  Archive,
  Download,
  Edit3,
  Clock,
  Sparkles,
  Zap,
  Music,
  Plus,
  Trash2,
} from "lucide-react"
import VideoPreview from "@/components/video-preview"
import { segmentScriptByNaturalRhythm, searchVideosForSegments } from "@/app/actions"

export default function CreatePage() {
  const [script, setScript] = useState("")
  const [isSegmenting, setIsSegmenting] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [segmentData, setSegmentData] = useState<any>(null)
  const [editingKeywords, setEditingKeywords] = useState(false)
  const [videoData, setVideoData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1) // 1: script, 2: segments, 3: videos

  const handleSegmentScript = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!script.trim()) return

    setIsSegmenting(true)
    setError(null)

    try {
      const result = await segmentScriptByNaturalRhythm(script)

      if (result.success) {
        setSegmentData(result)
        setStep(2)

        if (result.error) {
          setError(result.error)
        }
      } else {
        setError(result.error || "Failed to segment script")
      }
    } catch (error) {
      console.error("Error segmenting script:", error)
      setError(`An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsSegmenting(false)
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
        setStep(3)
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
      a.download = `natural-segments-${Date.now()}.zip`
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

  const handleUpdateDuration = (segmentId: number, newDuration: number) => {
    if (segmentData?.segments) {
      // Ensure duration is within reasonable bounds
      const clampedDuration = Math.max(1, Math.min(15, newDuration))

      const updatedSegments = segmentData.segments.map((segment: any) =>
        segment.id === segmentId ? { ...segment, duration: clampedDuration } : segment,
      )

      // Recalculate start and end times for all segments
      let currentTime = 0
      const recalculatedSegments = updatedSegments.map((segment: any) => {
        const updatedSegment = {
          ...segment,
          startTime: currentTime,
          endTime: currentTime + segment.duration,
        }
        currentTime += segment.duration
        return updatedSegment
      })

      // Update total duration
      const newTotalDuration = recalculatedSegments.reduce((acc: number, seg: any) => acc + seg.duration, 0)

      setSegmentData({
        ...segmentData,
        segments: recalculatedSegments,
        totalDuration: newTotalDuration,
      })
    }
  }

  const handleStartOver = () => {
    setScript("")
    setSegmentData(null)
    setVideoData(null)
    setError(null)
    setStep(1)
    setEditingKeywords(false)
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
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="container max-w-7xl py-8 px-6">
        <div className="mb-8">
          <Link href="/" className="flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-4 text-blue-900">Natural Speech Video Segments</h1>
              <p className="text-blue-700 text-lg">
                Segments based on natural speech rhythm with AI-powered keyword extraction.
              </p>
            </div>

            {/* AI Status */}
            <Card className="border-2 border-green-200 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 font-medium">Groq AI Ready</span>
                  <Badge className="bg-green-100 text-green-800 border border-green-300">Enhanced Analysis</Badge>
                  <Badge className="bg-purple-100 text-purple-800 border border-purple-300">Natural Rhythm</Badge>
                </div>
              </CardContent>
            </Card>

            {error && (
              <Alert
                className={`border-2 ${
                  error.includes("Note:") || error.includes("completed successfully")
                    ? "border-blue-200 bg-blue-50"
                    : error.includes("Groq API") || error.includes("enhanced AI")
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-red-200 bg-red-50"
                }`}
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription
                  className={
                    error.includes("completed successfully")
                      ? "text-blue-800"
                      : error.includes("Groq API") || error.includes("enhanced AI")
                        ? "text-yellow-800"
                        : ""
                  }
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
                    Step 1: Enter Your Script
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSegmentScript} className="space-y-6">
                    <div className="space-y-3">
                      <label htmlFor="script" className="text-sm font-semibold text-blue-900">
                        Your Script
                      </label>
                      <Textarea
                        id="script"
                        placeholder="Enter your script here. We'll automatically divide it into natural speech segments with concrete visual keywords..."
                        className="min-h-[200px] border-2 border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        disabled={isSegmenting}
                      />
                    </div>

                    {script.trim() && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-700">
                          <strong>Word count:</strong> {script.trim().split(/\s+/).length} words
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Segments will follow natural speech rhythm (5-10 seconds each)
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isSegmenting || !script.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
                      size="lg"
                    >
                      {isSegmenting ? (
                        <>
                          <Clock className="mr-2 h-5 w-5 animate-pulse" />
                          AI analyzing speech rhythm...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-5 w-5" />
                          AI Analyze & Create Natural Segments
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 2 && segmentData && (
              <Card className="border-2 border-blue-200 shadow-lg">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="text-blue-900 flex items-center gap-2">
                    <Music className="h-5 w-5" />
                    Step 2: Natural Speech Segments & Keywords
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                      <div className="text-lg font-bold text-blue-900">{segmentData.segmentCount}</div>
                      <div className="text-xs text-blue-700">Segments</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                      <div className="text-lg font-bold text-blue-900">{segmentData.totalDuration}s</div>
                      <div className="text-xs text-blue-700">Duration</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                      <div className="text-lg font-bold text-blue-900">5-10s</div>
                      <div className="text-xs text-blue-700">Per Segment</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                      <div className="text-lg font-bold text-blue-900">
                        {segmentData.durationCalculation?.wordCount || 0}
                      </div>
                      <div className="text-xs text-blue-700">Words</div>
                    </div>
                  </div>

                  {segmentData.durationCalculation && !segmentData.durationCalculation.usingFallback && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Groq AI Duration Analysis
                      </h4>
                      <div className="text-sm text-green-800 space-y-1">
                        <div>
                          <strong>Speaking rate:</strong> {segmentData.durationCalculation.speakingRate} words/minute
                        </div>
                        <div>
                          <strong>Reasoning:</strong> {segmentData.durationCalculation.reasoning}
                        </div>
                      </div>
                    </div>
                  )}

                  {segmentData.durationCalculation?.usingFallback && (
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <h4 className="font-semibold text-yellow-900 mb-2">Fallback Duration Calculation</h4>
                      <div className="text-sm text-yellow-800">
                        Using average speaking rate of 150 words/minute. Groq AI analysis failed.
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-purple-700">
                      <strong>
                        {segmentData.usingFallback ? "Fallback Keyword Extraction" : "Groq AI Keyword Generation"}
                      </strong>
                      <p className="mt-1">
                        {segmentData.usingFallback
                          ? "Keywords were generated using our rule-based system due to AI processing error."
                          : "Keywords were generated using Groq AI to identify the most concrete, visual elements in each segment. You can edit any keyword to better match your vision."}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-blue-900">Natural Speech Timeline</h4>
                      <div className="flex gap-2">
                        {editingKeywords && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newSegment = {
                                id: (segmentData.segments?.length || 0) + 1,
                                text: "Custom segment",
                                startTime: segmentData.segments?.length
                                  ? segmentData.segments[segmentData.segments.length - 1].endTime
                                  : 0,
                                endTime:
                                  (segmentData.segments?.length
                                    ? segmentData.segments[segmentData.segments.length - 1].endTime
                                    : 0) + 7,
                                duration: 7,
                                keyword: "new keyword",
                              }
                              setSegmentData({
                                ...segmentData,
                                segments: [...(segmentData.segments || []), newSegment],
                                segmentCount: (segmentData.segmentCount || 0) + 1,
                              })
                            }}
                            className="border-green-300 text-green-700 hover:bg-green-50"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Segment
                          </Button>
                        )}
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
                                <span className="text-xs text-blue-600">{segment.duration}s</span>
                              </div>

                              <p className="text-sm text-blue-900 font-medium">"{segment.text}"</p>

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-blue-700">Visual Keyword:</span>
                                {editingKeywords ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input
                                      value={segment.keyword}
                                      onChange={(e) => handleUpdateKeyword(segment.id, e.target.value)}
                                      className="text-xs h-7 border-blue-300 focus:border-blue-500 flex-1"
                                      placeholder="concrete visual keyword"
                                    />
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        value={segment.duration}
                                        onChange={(e) =>
                                          handleUpdateDuration(segment.id, Number.parseFloat(e.target.value) || 5)
                                        }
                                        className="text-xs h-7 border-blue-300 focus:border-blue-500 w-16"
                                        placeholder="5.0"
                                        min="1"
                                        max="15"
                                        step="0.5"
                                      />
                                      <span className="text-xs text-blue-600">s</span>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const updatedSegments = segmentData.segments.filter(
                                          (s: any) => s.id !== segment.id,
                                        )
                                        // Re-number the segments
                                        const renumberedSegments = updatedSegments.map((s: any, index: number) => ({
                                          ...s,
                                          id: index + 1,
                                        }))
                                        setSegmentData({
                                          ...segmentData,
                                          segments: renumberedSegments,
                                          segmentCount: renumberedSegments.length,
                                        })
                                      }}
                                      className="h-7 w-7 p-0 border-red-300 text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-green-100 text-green-800 border border-green-300 text-xs">
                                      {segment.keyword}
                                    </Badge>
                                    <Badge className="bg-blue-100 text-blue-800 border border-blue-300 text-xs">
                                      {segment.duration}s
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {editingKeywords && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h5 className="font-semibold text-blue-900 mb-2">Editing Tips</h5>
                        <ul className="text-sm text-blue-700 space-y-1">
                          <li>• Click "Add Segment" to create additional video segments</li>
                          <li>• Use the trash icon to remove segments you don't need</li>
                          <li>• Edit keywords to be more specific or visual</li>
                          <li>• Adjust duration (1-15 seconds) to control segment timing</li>
                          <li>• Total duration will update automatically</li>
                          <li>• Each segment will find one matching video</li>
                        </ul>
                      </div>
                    )}
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
                          Search Videos ({segmentData.segmentCount} segments)
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
                    Step 3: Natural Speech Video Sequence
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
                        {videoData.segments.reduce((acc: number, segment: any) => acc + segment.duration, 0)}s
                      </div>
                      <div className="text-sm text-blue-700">Total Duration</div>
                    </div>
                  </div>

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
                          </div>

                          <p className="text-blue-900 font-medium">"{clip.text}"</p>

                          <div className="flex items-center gap-2">
                            {clip.quality && (
                              <Badge className={`text-xs ${getQualityColor(clip.quality)}`}>{clip.quality}</Badge>
                            )}
                            {clip.duration && (
                              <span className="text-xs text-blue-600">
                                {clip.duration}s available for {clip.endTime - clip.startTime}s segment
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
                              <Link
                                href={clip.pexelsVideo.url}
                                target="_blank"
                                className="flex items-center gap-1 hover:text-blue-800 transition-colors"
                              >
                                View on Pexels <ExternalLink className="h-3 w-3" />
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleDownloadAll}
                      disabled={videoData.foundCount === 0 || isDownloading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
                      size="lg"
                    >
                      {isDownloading ? (
                        <>
                          <Download className="mr-2 h-5 w-5 animate-pulse" />
                          Downloading sequence...
                        </>
                      ) : (
                        <>
                          <Archive className="mr-2 h-5 w-5" />
                          Download Natural Speech Sequence ({videoData.foundCount} videos)
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleStartOver}
                      disabled={isDownloading}
                      className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      Start Over
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200 p-6">
            {step === 1 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
                  <Music className="h-10 w-10 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-blue-900 mb-2">Natural Speech Analysis</h3>
                  <p className="text-blue-700">
                    Segments follow natural speech rhythm (5-10 seconds) for more organic video pacing.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && segmentData && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-blue-900">Segment Preview</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">Natural Speech Timeline</h4>
                    <p className="text-sm text-blue-700">
                      {segmentData.segmentCount} segments created based on natural speech rhythm with{" "}
                      {segmentData.usingFallback ? "rule-based" : "AI-generated"} visual keywords.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-900">Sample Keywords</h4>
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
                          {segment.duration}s
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

            {step === 3 && videoData && <VideoPreview clips={videoData.clips} />}
          </div>
        </div>
      </div>
    </div>
  )
}
