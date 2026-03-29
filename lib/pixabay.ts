interface PixabayVideo {
  id: number
  pageURL: string
  type: string
  tags: string
  duration: number
  videos: {
    large?: {
      url: string
      width: number
      height: number
      size: number
    }
    medium?: {
      url: string
      width: number
      height: number
      size: number
    }
    small?: {
      url: string
      width: number
      height: number
      size: number
    }
    tiny?: {
      url: string
      width: number
      height: number
      size: number
    }
  }
  views: number
  downloads: number
  favorites: number
  likes: number
  comments: number
  user_id: number
  user: string
  userImageURL: string
}

interface PixabaySearchResponse {
  total: number
  totalHits: number
  hits: PixabayVideo[]
}

export class PixabayAPI {
  private apiKey: string
  private baseUrl = "https://pixabay.com/api/videos/"

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async makeRequest(params: Record<string, string>): Promise<PixabaySearchResponse> {
    const searchParams = new URLSearchParams({
      key: this.apiKey,
      ...params,
    })

    const response = await fetch(`${this.baseUrl}?${searchParams}`)

    if (!response.ok) {
      throw new Error(`Pixabay API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async searchVideos(query: string, perPage = 5): Promise<PixabaySearchResponse> {
    return this.makeRequest({
      q: encodeURIComponent(query),
      per_page: perPage.toString(),
      video_type: "all",
      orientation: "all",
      category: "all",
      min_duration: "5",
      order: "popular",
      safesearch: "true",
    })
  }

  // Get the best quality video file for a given video
  getBestVideoFile(video: PixabayVideo): string | null {
    if (!video.videos) {
      return null
    }

    // Prefer large, then medium, then small, then tiny
    const preferredQualities = ["large", "medium", "small", "tiny"] as const

    for (const quality of preferredQualities) {
      const file = video.videos[quality]
      if (file && file.url) {
        return file.url
      }
    }

    return null
  }

  // Get thumbnail image for video (Pixabay doesn't provide video thumbnails, so we'll use a placeholder)
  getThumbnail(video: PixabayVideo): string {
    // Pixabay doesn't provide video thumbnails in their API response
    // We'll use a placeholder or could potentially use the first frame
    return `/placeholder.svg?height=180&width=320&text=${encodeURIComponent(video.tags.split(",")[0] || "video")}`
  }

  // Get video quality label
  getVideoQuality(video: PixabayVideo): string {
    if (!video.videos) return "Unknown"

    if (video.videos.large) return "HD"
    if (video.videos.medium) return "SD"
    if (video.videos.small) return "Low"
    if (video.videos.tiny) return "Tiny"

    return "Unknown"
  }
}
