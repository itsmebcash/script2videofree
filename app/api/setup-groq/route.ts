import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("gsk_")) {
      return NextResponse.json(
        { success: false, error: "Invalid API key format. Groq API keys should start with 'gsk_'" },
        { status: 400 },
      )
    }

    // Test the API key with a simple request
    try {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.json()
        return NextResponse.json(
          {
            success: false,
            error: `API key validation failed: ${error.error?.message || response.statusText}`,
          },
          { status: 400 },
        )
      }

      // Set the API key in an environment variable (this will only work for the current session)
      process.env.GROQ_API_KEY = apiKey

      return NextResponse.json({ success: true })
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to validate API key: ${error instanceof Error ? error.message : String(error)}`,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Invalid request: ${error instanceof Error ? error.message : String(error)}` },
      { status: 400 },
    )
  }
}
