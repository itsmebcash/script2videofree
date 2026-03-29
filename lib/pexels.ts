interface PexelsVideo {
  id: number
  width: number
  height: number
  duration: number
  full_res: string | null
  tags: string[]
  url: string
  image: string
  avg_color: string | null
  user: {
    id: number
    name: string
    url: string
  }
  video_files: Array<{
    id: number
    quality: string
    file_type: string
    width: number
    height: number
    fps: number
    link: string
  }>
  video_pictures: Array<{
    id: number
    nr: number
    picture: string
  }>
}

interface PexelsSearchResponse {
  page: number
  per_page: number
  total_results: number
  prev_page: string | null
  next_page: string | null
  videos: PexelsVideo[]
}

export class PexelsAPI {
  private apiKey: string
  private baseUrl = "https://api.pexels.com"

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async makeRequest(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async searchVideos(query: string, perPage = 5): Promise<PexelsSearchResponse> {
    const encodedQuery = encodeURIComponent(query)
    return this.makeRequest(`/videos/search?query=${encodedQuery}&per_page=${perPage}&orientation=landscape`)
  }

  async getPopularVideos(perPage = 10): Promise<PexelsSearchResponse> {
    return this.makeRequest(`/videos/popular?per_page=${perPage}&orientation=landscape`)
  }

  // Get the best quality video file for a given video
  getBestVideoFile(video: PexelsVideo): string | null {
    if (!video.video_files || video.video_files.length === 0) {
      return null
    }

    // Prefer HD quality, then SD, then original
    const preferredQualities = ["hd", "sd", "original"]

    for (const quality of preferredQualities) {
      const file = video.video_files.find((f) => f.quality === quality)
      if (file) {
        return file.link
      }
    }

    // If no preferred quality found, return the first available
    return video.video_files[0]?.link || null
  }

  // Get thumbnail image for video
  getThumbnail(video: PexelsVideo): string {
    return video.video_pictures?.[0]?.picture || video.image || "/placeholder.svg?height=180&width=320"
  }
}
