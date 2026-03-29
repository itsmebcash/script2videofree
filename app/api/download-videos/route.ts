import { type NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"

export async function POST(request: NextRequest) {
  try {
    const { clips } = await request.json()

    if (!clips || !Array.isArray(clips)) {
      return NextResponse.json({ error: "Invalid clips data" }, { status: 400 })
    }

    // Filter clips that have valid download URLs
    const validClips = clips.filter((clip: any) => clip.downloadUrl && clip.keyword)

    if (validClips.length === 0) {
      return NextResponse.json({ error: "No valid videos to download" }, { status: 400 })
    }

    const zip = new JSZip()

    // Download each video and add to ZIP
    for (let i = 0; i < validClips.length; i++) {
      const clip = validClips[i]

      try {
        console.log(`Downloading video ${i + 1}/${validClips.length}: ${clip.keyword}`)

        // Fetch the video file
        const videoResponse = await fetch(clip.downloadUrl)

        if (!videoResponse.ok) {
          console.warn(`Failed to download video for keyword "${clip.keyword}": ${videoResponse.status}`)
          continue
        }

        // Get the video data as array buffer
        const videoData = await videoResponse.arrayBuffer()

        // Determine file extension from URL or default to mp4
        const urlParts = clip.downloadUrl.split(".")
        const extension = urlParts.length > 1 ? urlParts[urlParts.length - 1].split("?")[0] : "mp4"

        // Create a safe filename
        const safeKeyword = clip.keyword.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()
        const filename = `${i + 1}_${safeKeyword}.${extension}`

        // Add video to ZIP
        zip.file(filename, videoData)

        console.log(`Added to ZIP: ${filename}`)
      } catch (error) {
        console.error(`Error downloading video for keyword "${clip.keyword}":`, error)
        continue
      }
    }

    // Check if we have any files in the ZIP
    const zipFiles = Object.keys(zip.files)
    if (zipFiles.length === 0) {
      return NextResponse.json({ error: "Failed to download any videos" }, { status: 500 })
    }

    // Generate ZIP file
    console.log(`Generating ZIP file with ${zipFiles.length} videos...`)
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" })

    // Create response with ZIP file
    const response = new NextResponse(zipBuffer)

    // Set headers for file download
    response.headers.set("Content-Type", "application/zip")
    response.headers.set("Content-Disposition", `attachment; filename="script-videos-${Date.now()}.zip"`)
    response.headers.set("Content-Length", zipBuffer.byteLength.toString())

    return response
  } catch (error) {
    console.error("Error creating ZIP file:", error)
    return NextResponse.json({ error: "Failed to create ZIP file" }, { status: 500 })
  }
}
