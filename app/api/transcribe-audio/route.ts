import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    // Validate file type
    if (!audioFile.type.startsWith("audio/")) {
      return NextResponse.json({ error: "Invalid file type. Please upload an audio file." }, { status: 400 })
    }

    // Check file size (limit to 25MB)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Please upload a file smaller than 25MB." }, { status: 400 })
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)

    // Try OpenAI Whisper API if available
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (openaiApiKey) {
      try {
        console.log("Using OpenAI Whisper API for transcription")

        // Create form data for OpenAI API
        const whisperFormData = new FormData()
        whisperFormData.append("file", new Blob([audioBuffer], { type: audioFile.type }), audioFile.name)
        whisperFormData.append("model", "whisper-1")
        whisperFormData.append("language", "en")
        whisperFormData.append("response_format", "json")

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: whisperFormData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`)
        }

        const result = await response.json()

        return NextResponse.json({
          success: true,
          text: result.text,
          method: "openai-whisper",
          duration: result.duration || null,
        })
      } catch (error) {
        console.error("OpenAI Whisper API failed:", error)
        // Fall through to alternative methods
      }
    }

    // Fallback: Return instructions for manual transcription
    return NextResponse.json({
      success: false,
      error:
        "Automatic transcription not available. Please manually type your script or add OpenAI API key for Whisper transcription.",
      fallback: true,
      instructions: [
        "1. Play your audio file using any media player",
        "2. Listen and manually type the content into the script field",
        "3. Or add your OpenAI API key to enable automatic transcription",
        "4. The original audio will still be used in your final video",
      ],
    })
  } catch (error) {
    console.error("Error processing audio file:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process audio file",
        fallback: true,
      },
      { status: 500 },
    )
  }
}
