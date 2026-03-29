export interface AudioSegment {
  startTime: number
  endTime: number
  duration: number
  type: "speech" | "silence"
  volume?: number
}

export interface AudioAnalysisResult {
  totalDuration: number
  speechSegments: AudioSegment[]
  silenceSegments: AudioSegment[]
  averageVolume: number
  speechRatio: number
}

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null
  private audioBuffer: AudioBuffer | null = null

  async analyzeAudio(audioFile: File): Promise<AudioAnalysisResult> {
    try {
      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      // Convert file to array buffer
      const arrayBuffer = await audioFile.arrayBuffer()

      // Decode audio data
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      const sampleRate = this.audioBuffer.sampleRate
      const channelData = this.audioBuffer.getChannelData(0) // Use first channel
      const totalDuration = this.audioBuffer.duration

      console.log(`Analyzing audio: ${totalDuration}s, ${sampleRate}Hz, ${channelData.length} samples`)

      // Analyze audio in chunks to detect speech vs silence
      const chunkSize = Math.floor(sampleRate * 0.1) // 100ms chunks
      const chunks: { startTime: number; endTime: number; volume: number }[] = []

      for (let i = 0; i < channelData.length; i += chunkSize) {
        const chunk = channelData.slice(i, Math.min(i + chunkSize, channelData.length))

        // Calculate RMS (Root Mean Square) for volume
        const rms = Math.sqrt(chunk.reduce((sum, sample) => sum + sample * sample, 0) / chunk.length)

        chunks.push({
          startTime: i / sampleRate,
          endTime: Math.min((i + chunkSize) / sampleRate, totalDuration),
          volume: rms,
        })
      }

      // Calculate average volume for threshold
      const averageVolume = chunks.reduce((sum, chunk) => sum + chunk.volume, 0) / chunks.length
      const silenceThreshold = averageVolume * 0.1 // 10% of average volume

      console.log(`Average volume: ${averageVolume}, Silence threshold: ${silenceThreshold}`)

      // Group consecutive chunks into speech/silence segments
      const segments: AudioSegment[] = []
      let currentSegment: AudioSegment | null = null

      for (const chunk of chunks) {
        const isSpeech = chunk.volume > silenceThreshold
        const segmentType = isSpeech ? "speech" : "silence"

        if (!currentSegment || currentSegment.type !== segmentType) {
          // Start new segment
          if (currentSegment) {
            segments.push(currentSegment)
          }

          currentSegment = {
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            duration: chunk.endTime - chunk.startTime,
            type: segmentType,
            volume: chunk.volume,
          }
        } else {
          // Extend current segment
          currentSegment.endTime = chunk.endTime
          currentSegment.duration = currentSegment.endTime - currentSegment.startTime
          currentSegment.volume = Math.max(currentSegment.volume || 0, chunk.volume)
        }
      }

      // Add final segment
      if (currentSegment) {
        segments.push(currentSegment)
      }

      // Filter out very short segments (less than 0.5 seconds)
      const filteredSegments = segments.filter((segment) => segment.duration >= 0.5)

      // Separate speech and silence segments
      const speechSegments = filteredSegments.filter((s) => s.type === "speech")
      const silenceSegments = filteredSegments.filter((s) => s.type === "silence")

      const speechDuration = speechSegments.reduce((sum, s) => sum + s.duration, 0)
      const speechRatio = speechDuration / totalDuration

      console.log(`Audio analysis complete:`)
      console.log(`- Total duration: ${totalDuration}s`)
      console.log(`- Speech segments: ${speechSegments.length} (${speechDuration.toFixed(1)}s)`)
      console.log(`- Silence segments: ${silenceSegments.length}`)
      console.log(`- Speech ratio: ${(speechRatio * 100).toFixed(1)}%`)

      return {
        totalDuration,
        speechSegments,
        silenceSegments,
        averageVolume,
        speechRatio,
      }
    } catch (error) {
      console.error("Audio analysis failed:", error)

      // Fallback: estimate based on file size and duration
      const estimatedDuration = this.estimateDurationFromFile(audioFile)

      return {
        totalDuration: estimatedDuration,
        speechSegments: [
          {
            startTime: 0,
            endTime: estimatedDuration,
            duration: estimatedDuration,
            type: "speech",
          },
        ],
        silenceSegments: [],
        averageVolume: 0.5,
        speechRatio: 1.0,
      }
    }
  }

  private estimateDurationFromFile(audioFile: File): number {
    // Rough estimation based on file size
    // Assuming average bitrate of 128kbps for MP3
    const fileSizeKB = audioFile.size / 1024
    const estimatedDuration = (fileSizeKB * 8) / 128
    return Math.max(estimatedDuration, 10) // Minimum 10 seconds
  }

  // Create video segments that match audio timing including silence
  createVideoSegments(
    keywords: string[],
    audioAnalysis: AudioAnalysisResult,
    targetSegmentDuration = 6,
  ): Array<{
    id: string
    keyword: string
    text: string
    startTime: number
    endTime: number
    duration: number
    audioSegmentType: "speech" | "silence" | "mixed"
  }> {
    const segments: Array<{
      id: string
      keyword: string
      text: string
      startTime: number
      endTime: number
      duration: number
      audioSegmentType: "speech" | "silence" | "mixed"
    }> = []

    const totalDuration = audioAnalysis.totalDuration
    let currentTime = 0
    let keywordIndex = 0

    console.log(`Creating video segments for FULL ${totalDuration}s audio with ${keywords.length} keywords`)

    // Ensure we create enough segments to cover the ENTIRE audio duration
    while (currentTime < totalDuration) {
      const remainingTime = totalDuration - currentTime
      // Use smaller segments for longer audio to prevent memory issues, but ensure full coverage
      const adjustedSegmentDuration = totalDuration > 120 ? 4 : targetSegmentDuration
      const segmentDuration = Math.min(adjustedSegmentDuration, remainingTime)

      // Ensure minimum segment duration of 2 seconds
      const finalSegmentDuration = Math.max(segmentDuration, 2)
      const endTime = currentTime + finalSegmentDuration

      // Determine what type of audio this segment covers
      const audioSegmentType = this.getAudioSegmentType(
        currentTime,
        endTime,
        audioAnalysis.speechSegments,
        audioAnalysis.silenceSegments,
      )

      // Use keyword or create a filler segment
      const keyword = keywords[keywordIndex % keywords.length] || `segment-${segments.length + 1}`

      segments.push({
        id: `segment-${segments.length + 1}`,
        keyword: keyword,
        text: `Video segment for: ${keyword}`,
        startTime: Math.round(currentTime * 10) / 10,
        endTime: Math.round(endTime * 10) / 10,
        duration: Math.round(finalSegmentDuration * 10) / 10,
        audioSegmentType,
      })

      currentTime = endTime
      keywordIndex++

      // Safety check to prevent infinite loops
      if (segments.length > 100) {
        console.warn(`Created maximum of 100 segments to prevent memory issues. Audio duration: ${totalDuration}s`)
        break
      }
    }

    const totalCalculatedDuration = segments.reduce((sum, seg) => sum + seg.duration, 0)
    console.log(
      `✓ Created ${segments.length} video segments covering ${totalCalculatedDuration}s of ${totalDuration}s audio`,
    )
    console.log(
      `Segment breakdown:`,
      segments.map((s) => `${s.keyword}(${s.duration}s-${s.audioSegmentType})`).join(", "),
    )

    return segments
  }

  private getAudioSegmentType(
    startTime: number,
    endTime: number,
    speechSegments: AudioSegment[],
    silenceSegments: AudioSegment[],
  ): "speech" | "silence" | "mixed" {
    const segmentDuration = endTime - startTime
    let speechOverlap = 0
    let silenceOverlap = 0

    // Calculate overlap with speech segments
    for (const speech of speechSegments) {
      const overlapStart = Math.max(startTime, speech.startTime)
      const overlapEnd = Math.min(endTime, speech.endTime)
      if (overlapStart < overlapEnd) {
        speechOverlap += overlapEnd - overlapStart
      }
    }

    // Calculate overlap with silence segments
    for (const silence of silenceSegments) {
      const overlapStart = Math.max(startTime, silence.startTime)
      const overlapEnd = Math.min(endTime, silence.endTime)
      if (overlapStart < overlapEnd) {
        silenceOverlap += overlapEnd - overlapStart
      }
    }

    const speechRatio = speechOverlap / segmentDuration
    const silenceRatio = silenceOverlap / segmentDuration

    if (speechRatio > 0.7) return "speech"
    if (silenceRatio > 0.7) return "silence"
    return "mixed"
  }

  cleanup() {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.audioBuffer = null
  }
}
