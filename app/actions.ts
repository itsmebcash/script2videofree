"use server"

import { generateText } from "ai"
import { groq } from "@ai-sdk/groq"
import { PexelsAPI } from "@/lib/pexels"
import { PixabayAPI } from "@/lib/pixabay"

interface ScriptSegment {
  id: number
  text: string
  startTime: number
  endTime: number
  duration: number
  keyword: string
}

interface VideoClip {
  id: string
  segmentId: number
  keyword: string
  url: string | null
  thumbnail: string
  text: string
  startTime: number
  endTime: number
  pexelsVideo?: any
  pixabayVideo?: any
  downloadUrl?: string
  quality?: string
  duration?: number
  source?: "pexels" | "pixabay"
}

// Embedded API keys
const GROQ_API_KEY = "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"
const PIXABAY_API_KEY = "50745718-10e523c8fec1d616201a2209e"

// Focused, high-quality visual keywords for better video matching
const CORE_VISUAL_KEYWORDS = [
  // Business & Work
  "office meeting",
  "business handshake",
  "typing laptop",
  "presentation",
  "teamwork",
  "success celebration",

  // Technology
  "smartphone",
  "computer screen",
  "technology innovation",
  "data analysis",

  // People & Emotions
  "smiling person",
  "thinking person",
  "group discussion",
  "leadership",

  // Nature & Environment
  "city skyline",
  "mountain landscape",
  "ocean waves",
  "forest trees",

  // Growth & Progress
  "growth chart",
  "money coins",
  "goal achievement",
  "planning strategy",

  // Creative & Learning
  "creative design",
  "learning education",
  "reading book",
  "writing notes",

  // Health & Lifestyle
  "fitness workout",
  "healthy lifestyle",
  "meditation",
  "travel adventure",
]

// Utility function to round numbers properly
function roundToDecimal(num: number, decimals = 1): number {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

// Global video selection tracking to ensure variety
const videoSelectionHistory = new Map<string, number[]>()

function getRandomVideoFromResults(videos: any[], keyword: string): any | null {
  if (!videos || videos.length === 0) return null

  // Use first 20 results for variety
  const availableVideos = videos.slice(0, Math.min(20, videos.length))

  if (availableVideos.length === 0) return null

  // Get previously used video indices for this keyword
  const usedIndices = videoSelectionHistory.get(keyword) || []

  // Find unused videos
  const unusedVideos = availableVideos.filter((_, index) => !usedIndices.includes(index))

  let selectedVideo: any
  let selectedIndex: number

  if (unusedVideos.length > 0) {
    // Pick random from unused videos
    const randomUnusedIndex = Math.floor(Math.random() * unusedVideos.length)
    selectedVideo = unusedVideos[randomUnusedIndex]
    selectedIndex = availableVideos.indexOf(selectedVideo)
  } else {
    // All videos used, reset and pick random
    videoSelectionHistory.set(keyword, [])
    const randomIndex = Math.floor(Math.random() * availableVideos.length)
    selectedVideo = availableVideos[randomIndex]
    selectedIndex = randomIndex
  }

  // Track this selection
  const currentHistory = videoSelectionHistory.get(keyword) || []
  currentHistory.push(selectedIndex)
  videoSelectionHistory.set(keyword, currentHistory)

  console.log(
    `Selected video ${selectedIndex + 1}/${availableVideos.length} for keyword "${keyword}" (${currentHistory.length} used)`,
  )

  return selectedVideo
}

export async function calculateScriptDuration(script: string) {
  try {
    if (!GROQ_API_KEY) {
      throw new Error("Groq API key is missing")
    }

    try {
      console.log("Using Groq AI for script duration calculation")
      const { text: analysis } = await generateText({
        model: groq("llama-3.1-8b-instant", { apiKey: GROQ_API_KEY }),
        prompt: `
          Calculate the estimated speaking duration for this script in seconds.
          
          Consider:
          - Natural speaking pace (not rushed, not too slow)
          - Pauses for emphasis and breath
          - Punctuation that indicates pauses
          - Overall flow and readability
          
          Script: "${script}"
          
          IMPORTANT: Respond ONLY with a valid JSON object, no other text:
          {
            "duration": number_of_seconds,
            "wordCount": number_of_words,
            "speakingRate": words_per_minute,
            "reasoning": "brief explanation of calculation"
          }
        `,
      })

      // Clean the response to ensure it's valid JSON
      const cleanedAnalysis = analysis
        .trim()
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "")
      const result = JSON.parse(cleanedAnalysis)

      return {
        success: true,
        duration: Math.max(roundToDecimal(result.duration), 10), // Minimum 10 seconds
        wordCount: result.wordCount,
        speakingRate: result.speakingRate,
        reasoning: result.reasoning,
        usingFallback: false,
      }
    } catch (error) {
      console.error("Groq API error in calculateScriptDuration:", error)

      // Fallback calculation
      const wordCount = script.trim().split(/\s+/).length
      const estimatedDuration = roundToDecimal((wordCount / 150) * 60)

      return {
        success: true,
        duration: Math.max(estimatedDuration, 10),
        wordCount,
        usingFallback: true,
        error: `Groq API error: ${error instanceof Error ? error.message : "Unknown error"}`,
      }
    }
  } catch (error) {
    console.error("Error calculating script duration:", error)

    // Fallback calculation
    const wordCount = script.trim().split(/\s+/).length
    const estimatedDuration = roundToDecimal((wordCount / 150) * 60)

    return {
      success: true,
      duration: Math.max(estimatedDuration, 10),
      wordCount,
      usingFallback: true,
      error: "AI calculation failed, using fallback",
    }
  }
}

export async function segmentScriptByNaturalRhythm(script: string) {
  try {
    // First calculate the script duration
    const durationResult = await calculateScriptDuration(script)
    const estimatedDuration = durationResult.duration

    // Calculate maximum reasonable segments (minimum 4 seconds per segment)
    const maxSegments = Math.floor(estimatedDuration / 4)
    const minSegments = Math.max(1, Math.floor(estimatedDuration / 10)) // Maximum 10 seconds per segment

    console.log(`Script duration: ${estimatedDuration}s, allowing ${minSegments}-${maxSegments} segments`)

    let segments: ScriptSegment[]

    try {
      if (!GROQ_API_KEY) {
        throw new Error("Groq API key is missing")
      }

      console.log("Using Groq AI for script segmentation and keyword extraction")
      // Use AI for natural rhythm segmentation and keyword extraction
      const { text: analysis } = await generateText({
        model: groq("llama-3.1-8b-instant", { apiKey: GROQ_API_KEY }),
        prompt: `
          This script has an estimated speaking duration of ${estimatedDuration} seconds.
          
          IMPORTANT CONSTRAINTS:
          - Create ONLY ${minSegments} to ${maxSegments} segments (minimum 4 seconds, maximum 10 seconds each)
          - Each segment must be at least 4 seconds long
          - Break at natural pauses, sentence breaks, or logical points
          - Do NOT create more than ${maxSegments} segments
          
          For each segment, extract 1 visual keyword that best represents the main idea or emotion. Your keywords will be used to search for relevant stock videos.

          Follow these rules:
          - Use simple, searchable keywords (1-2 words max)
          - Focus on visual concepts that work well for stock footage
          - Avoid abstract concepts, use concrete visuals instead

          ### Examples:

          Script: "When you don't have money, people say, who are you? But when you have money, it's, hey, how are you?"
          → Segments: 2-3 segments max, keywords like "money", "people talking", "social interaction"

          Script: "${script}"
          
          IMPORTANT: 
          - Create MAXIMUM ${maxSegments} segments
          - Each segment must be 4-10 seconds
          - Respond ONLY with valid JSON, no explanatory text:
          
          {
            "segments": [
              {
                "id": 1,
                "text": "portion of script for this segment",
                "startTime": 0,
                "endTime": 6,
                "duration": 6,
                "keyword": "simple visual keyword"
              }
            ]
          }
        `,
      })

      // Clean the response to ensure it's valid JSON
      const cleanedAnalysis = analysis
        .trim()
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "")

      // Additional cleaning for common AI response patterns
      let jsonString = cleanedAnalysis
      if (jsonString.includes("Here's the") || jsonString.includes("Here is")) {
        // Find the JSON part
        const jsonMatch = jsonString.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonString = jsonMatch[0]
        }
      }

      const result = JSON.parse(jsonString)
      segments = result.segments

      // Validate segment count and durations
      if (segments.length > maxSegments) {
        console.warn(`AI created ${segments.length} segments, limiting to ${maxSegments}`)
        segments = segments.slice(0, maxSegments)
      }

      // Ensure each segment is at least 4 seconds and recalculate timing
      let currentTime = 0
      segments = segments.map((segment, index) => {
        const minDuration = 4
        const maxDuration = 10
        const targetDuration = Math.max(minDuration, Math.min(maxDuration, segment.duration || 6))

        // For the last segment, use remaining time if it's reasonable
        if (index === segments.length - 1) {
          const remainingTime = estimatedDuration - currentTime
          const finalDuration = remainingTime >= minDuration ? remainingTime : targetDuration

          return {
            ...segment,
            id: index + 1,
            keyword: cleanKeyword(segment.keyword),
            duration: roundToDecimal(finalDuration),
            startTime: roundToDecimal(currentTime),
            endTime: roundToDecimal(currentTime + finalDuration),
          }
        }

        const updatedSegment = {
          ...segment,
          id: index + 1,
          keyword: cleanKeyword(segment.keyword),
          duration: roundToDecimal(targetDuration),
          startTime: roundToDecimal(currentTime),
          endTime: roundToDecimal(currentTime + targetDuration),
        }

        currentTime += targetDuration
        return updatedSegment
      })
    } catch (error) {
      console.warn("AI segmentation failed, using fallback:", error)
      segments = segmentScriptFallback(script, Math.min(maxSegments, 3), true) // Limit fallback to 3 segments max

      return {
        success: true,
        segments: segments,
        totalDuration: estimatedDuration,
        segmentCount: segments.length,
        durationCalculation: durationResult,
        usingFallback: true,
        error: `Groq AI enhanced analysis failed. Using fallback segmentation.`,
      }
    }

    return {
      success: true,
      segments: segments,
      totalDuration: estimatedDuration,
      segmentCount: segments.length,
      durationCalculation: durationResult,
      usingFallback: false,
    }
  } catch (error) {
    console.error("Error in segmentScriptByNaturalRhythm:", error)

    // Try to create fallback segments even if there's an error
    try {
      const wordCount = script.trim().split(/\s+/).length
      const estimatedDuration = roundToDecimal((wordCount / 150) * 60)
      const maxSegments = Math.max(1, Math.floor(estimatedDuration / 4))
      const segments = segmentScriptFallback(script, Math.min(maxSegments, 3), true)

      return {
        success: true,
        segments: segments,
        totalDuration: estimatedDuration,
        segmentCount: segments.length,
        usingFallback: true,
        error: `Error occurred: ${error instanceof Error ? error.message : "Unknown error"}. Using fallback segmentation.`,
      }
    } catch (fallbackError) {
      return {
        success: false,
        error: `Failed to segment script: ${error instanceof Error ? error.message : "Unknown error"}`,
        segments: [],
      }
    }
  }
}

function cleanKeyword(keyword: string): string {
  if (!keyword) return "business meeting"

  // Clean the keyword but keep it simple
  const cleaned = keyword
    .toLowerCase()
    .trim()
    .replace(/[,.!?;:'"()]/g, "")
    .replace(/\s+/g, " ")

  // If it's already a good keyword, return it
  if (cleaned.length > 2 && cleaned.length < 25) {
    return cleaned
  }

  // Fallback to a high-quality keyword
  return CORE_VISUAL_KEYWORDS[Math.floor(Math.random() * CORE_VISUAL_KEYWORDS.length)]
}

export async function searchVideosForSegments(segments: ScriptSegment[]) {
  try {
    const pexelsApiKey = process.env.PEXELS_API_KEY
    if (!pexelsApiKey) {
      throw new Error("Pexels API key not configured. Please add PEXELS_API_KEY to your environment variables.")
    }

    const pexels = new PexelsAPI(pexelsApiKey)
    const pixabay = new PixabayAPI(PIXABAY_API_KEY)
    const videoClips: VideoClip[] = []

    for (const segment of segments) {
      try {
        console.log(`Searching for videos with keyword: "${segment.keyword}"`)

        // Search both Pexels and Pixabay with increased results for variety
        const [pexelsResults, pixabayResults] = await Promise.allSettled([
          pexels.searchVideos(segment.keyword, 20), // Increased from 5 to 20
          pixabay.searchVideos(segment.keyword, 20), // Increased from 5 to 20
        ])

        // Combine results from both sources
        const allVideos: Array<{ video: any; source: "pexels" | "pixabay" }> = []

        // Add Pexels videos
        if (pexelsResults.status === "fulfilled" && pexelsResults.value.videos) {
          pexelsResults.value.videos.forEach((video) => {
            allVideos.push({ video, source: "pexels" })
          })
        }

        // Add Pixabay videos
        if (pixabayResults.status === "fulfilled" && pixabayResults.value.hits) {
          pixabayResults.value.hits.forEach((video) => {
            allVideos.push({ video, source: "pixabay" })
          })
        }

        let bestClip: VideoClip | null = null

        if (allVideos.length > 0) {
          console.log(`Found ${allVideos.length} total videos for "${segment.keyword}"`)

          // Use random selection from first 20 results instead of always picking the first
          const selectedVideoData = getRandomVideoFromResults(allVideos, segment.keyword)

          if (selectedVideoData) {
            const { video, source } = selectedVideoData
            const score = calculateSegmentVideoScore(video, segment.duration, source)

            if (score > 30) {
              // Lowered threshold to accept more variety
              let videoUrl: string | null = null
              let thumbnail: string
              let quality: string
              let duration: number

              if (source === "pexels") {
                videoUrl = pexels.getBestVideoFile(video)
                thumbnail = pexels.getThumbnail(video)
                quality = getQualityLabel(score)
                duration = video.duration
              } else {
                videoUrl = pixabay.getBestVideoFile(video)
                thumbnail = pixabay.getThumbnail(video)
                quality = pixabay.getVideoQuality(video)
                duration = video.duration
              }

              if (videoUrl) {
                bestClip = {
                  id: `segment-${segment.id}`,
                  segmentId: segment.id,
                  keyword: segment.keyword,
                  url: videoUrl,
                  thumbnail: thumbnail,
                  text: segment.text,
                  startTime: segment.startTime,
                  endTime: segment.endTime,
                  downloadUrl: videoUrl,
                  quality: quality,
                  duration: duration,
                  source: source,
                }

                if (source === "pexels") {
                  bestClip.pexelsVideo = {
                    id: video.id,
                    user: video.user,
                    url: video.url,
                    tags: video.tags,
                    duration: video.duration,
                  }
                } else {
                  bestClip.pixabayVideo = {
                    id: video.id,
                    user: video.user,
                    pageURL: video.pageURL,
                    tags: video.tags,
                    duration: video.duration,
                  }
                }
              }
            }
          }
        }

        // Add the best clip or a placeholder
        if (bestClip) {
          videoClips.push(bestClip)
          console.log(`Selected random video from ${bestClip.source} for "${segment.keyword}"`)
        } else {
          videoClips.push({
            id: `segment-${segment.id}`,
            segmentId: segment.id,
            keyword: segment.keyword,
            url: null,
            thumbnail: "/placeholder.svg?height=180&width=320",
            text: segment.text,
            startTime: segment.startTime,
            endTime: segment.endTime,
            quality: "Not found",
          })
          console.log(`No suitable video found for "${segment.keyword}"`)
        }

        // Add delay to respect API rate limits
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error) {
        console.error(`Error searching for segment ${segment.id} keyword "${segment.keyword}":`, error)
        videoClips.push({
          id: `segment-${segment.id}`,
          segmentId: segment.id,
          keyword: segment.keyword,
          url: null,
          thumbnail: "/placeholder.svg?height=180&width=320",
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          quality: "Error",
        })
      }
    }

    return {
      success: true,
      clips: videoClips,
      segments: segments,
      foundCount: videoClips.filter((clip) => clip.url).length,
      totalCount: videoClips.length,
    }
  } catch (error) {
    console.error("Error in searchVideosForSegments:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search for segment videos",
      clips: [],
    }
  }
}

// Calculate video score optimized for variable segment durations
function calculateSegmentVideoScore(video: any, targetDuration: number, source: "pexels" | "pixabay"): number {
  let score = 0

  // Duration scoring (prefer videos close to target duration or longer)
  const videoDuration = video.duration || 0
  const durationDiff = Math.abs(videoDuration - targetDuration)

  if (videoDuration >= targetDuration) {
    score += 40 // Can be trimmed to fit
    if (videoDuration <= targetDuration + 10) {
      score += 20 // Close to ideal length
    }
  } else {
    score += Math.max(0, 20 - durationDiff * 2) // Penalty for too short
  }

  // Resolution/Quality scoring
  if (source === "pexels") {
    if (video.video_files) {
      const hasHD = video.video_files.some((file: any) => file.quality === "hd" && file.width >= 1280)
      if (hasHD) score += 30

      const hasSD = video.video_files.some((file: any) => file.quality === "sd" && file.width >= 640)
      if (hasSD) score += 15
    }
  } else {
    // Pixabay scoring
    if (video.videos) {
      if (video.videos.large) score += 30
      else if (video.videos.medium) score += 20
      else if (video.videos.small) score += 10
    }
  }

  // Tag relevance and popularity
  if (source === "pexels") {
    if (video.tags && video.tags.length > 0) {
      score += Math.min(video.tags.length * 2, 15)
    }
    if (video.user && video.user.name) {
      score += 5
    }
  } else {
    // Pixabay has different metrics
    if (video.tags) {
      score += Math.min(video.tags.split(",").length * 2, 15)
    }
    if (video.likes > 10) score += 5
    if (video.downloads > 100) score += 5
  }

  return score
}

function getQualityLabel(score: number): string {
  if (score >= 80) return "Excellent"
  if (score >= 60) return "Good"
  if (score >= 40) return "Fair"
  return "Basic"
}

// Fallback segmentation without AI
function segmentScriptFallback(script: string, maxSegments: number, useNaturalRhythm = false): ScriptSegment[] {
  // Split script into sentences
  const sentences = script.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const segments: ScriptSegment[] = []

  // Calculate total duration based on word count
  const wordCount = script.trim().split(/\s+/).length
  const estimatedDuration = roundToDecimal((wordCount / 150) * 60)

  // Ensure minimum 4 seconds per segment
  const actualMaxSegments = Math.min(maxSegments, Math.floor(estimatedDuration / 4))
  const segmentDuration = estimatedDuration / actualMaxSegments

  console.log(`Fallback: Creating ${actualMaxSegments} segments of ~${segmentDuration.toFixed(1)}s each`)

  // Group sentences into segments
  const sentencesPerSegment = Math.ceil(sentences.length / actualMaxSegments)

  for (let i = 0; i < actualMaxSegments; i++) {
    const startSentenceIndex = i * sentencesPerSegment
    const endSentenceIndex = Math.min((i + 1) * sentencesPerSegment, sentences.length)

    const segmentSentences = sentences.slice(startSentenceIndex, endSentenceIndex)
    const segmentText = segmentSentences.join(". ").trim()

    if (segmentText) {
      const startTime = roundToDecimal(i * segmentDuration)
      const endTime = roundToDecimal((i + 1) * segmentDuration)
      const duration = roundToDecimal(endTime - startTime)

      segments.push({
        id: i + 1,
        text: segmentText,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        keyword: extractVisualKeyword(segmentText),
      })
    }
  }

  return segments
}

function extractVisualKeyword(text: string): string {
  const words = text.toLowerCase().trim().split(/\s+/)

  // Look for money-related terms
  if (text.includes("money") || text.includes("dollar") || text.includes("rich") || text.includes("wealth")) {
    return "money"
  }

  // Look for people/social terms
  if (text.includes("people") || text.includes("person") || text.includes("you") || text.includes("who")) {
    return "people talking"
  }

  // Look for business/work related terms
  const businessTerms = ["business", "work", "office", "meeting", "team", "success", "growth", "strategy"]
  const techTerms = ["technology", "computer", "phone", "digital", "data", "innovation"]

  // Check for business terms
  for (const word of words) {
    const cleanWord = word.replace(/[,.!?;:'"()]/g, "")
    if (businessTerms.includes(cleanWord)) {
      return "business meeting"
    }
    if (techTerms.includes(cleanWord)) {
      return "technology"
    }
  }

  // Look for emotional context
  if (text.includes("beautiful") || text.includes("handsome") || text.includes("amazing")) {
    return "smiling person"
  }
  if (text.includes("power") || text.includes("strong")) {
    return "success celebration"
  }

  // Default to a contextual keyword
  return "social interaction"
}
