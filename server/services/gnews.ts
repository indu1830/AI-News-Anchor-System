interface GNewsArticle {
  title: string;
  description: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
}

interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

class GNewsService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://gnews.io/api/v4";
  private readonly cache = new Map<string, { data: GNewsArticle[]; timestamp: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.apiKey = process.env.GNEWS_API_KEY || process.env.API_KEY || "";
    if (!this.apiKey) {
      console.warn("GNews API key not found. Set GNEWS_API_KEY environment variable.");
    }
  }

  async checkStatus(): Promise<{ status: string; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/top-headlines?lang=en&max=1&token=${this.apiKey}`);
      if (response.ok) {
        return { status: "operational" };
      } else {
        return { status: "degraded", message: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { status: "down", message: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async fetchArticles(topic: string, language = "en", maxResults = 10): Promise<GNewsArticle[]> {
    const cacheKey = `${topic}-${language}-${maxResults}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    if (!this.apiKey) {
      throw new Error("GNews API key not configured");
    }

    try {
      const params = new URLSearchParams({
        q: topic,
        lang: language,
        max: maxResults.toString(),
        token: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`GNews API error: ${response.status} ${response.statusText}`);
      }

      const data: GNewsResponse = await response.json();
      
      // Filter out articles without descriptions or images
      const filteredArticles = data.articles.filter(article => 
        article.description && article.description.length > 50
      );

      this.cache.set(cacheKey, { data: filteredArticles, timestamp: Date.now() });
      return filteredArticles;
    } catch (error) {
      console.error("Error fetching from GNews:", error);
      throw error;
    }
  }

  async fetchTrendingTopics(language = "en"): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error("GNews API key not configured");
    }

    try {
      const params = new URLSearchParams({
        lang: language,
        max: "50",
        token: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}/top-headlines?${params}`);
      
      if (!response.ok) {
        throw new Error(`GNews API error: ${response.status} ${response.statusText}`);
      }

      const data: GNewsResponse = await response.json();
      
      // Extract topics from titles (simplified approach)
      const topics = new Set<string>();
      data.articles.forEach(article => {
        const words = article.title.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4 && !['this', 'that', 'with', 'from', 'they', 'have', 'will', 'been', 'says'].includes(word)) {
            topics.add(word);
          }
        });
      });

      return Array.from(topics).slice(0, 10);
    } catch (error) {
      console.error("Error fetching trending topics:", error);
      throw error;
    }
  }
}

export const gnewsService = new GNewsService();
