interface VideoRenderRequest {
  summary: string;
  audioUrl: string;
  duration: number;
  images: string[];
  title: string;
  theme?: string;
}

interface VideoRenderResult {
  urlMp4: string;
  urlSrt?: string | null;
  urlThumb: string;
  width: number;
  height: number;
  duration: number;
  size: number;
}

class VideoService {
  private readonly serviceUrl: string;

  constructor() {
    this.serviceUrl = process.env.VIDEO_SERVICE_URL || "http://localhost:8002";
  }

  async checkStatus(): Promise<{ status: string; message?: string }> {
    try {
      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        return { status: "operational" };
      } else {
        return { status: "degraded", message: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { 
        status: "down", 
        message: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  async generateTTS(text: string, language: string = 'en'): Promise<{
    audioUrl: string;
    duration: number;
    format: string;
  }> {
    try {
      const payload = {
        text: text,
        language: language,
        voice: 'neutral',
        speed: 1.0,
        format: 'mp3',
      };

      const response = await fetch(`${this.serviceUrl}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return {
        audioUrl: result.audio_url,
        duration: result.duration,
        format: result.format || 'mp3',
      };
    } catch (error) {
      console.error('Error generating TTS:', error);
      throw error;
    }
  }

  async renderVideo(request: VideoRenderRequest): Promise<VideoRenderResult> {
    try {
      const payload = {
        summary: request.summary,
        audioUrl: request.audioUrl,
        duration: request.duration,
        images: request.images,
        title: request.title,
        theme: request.theme,
      };

      console.log('📤 Sending to video service:', `${this.serviceUrl}/render`);

      const response = await fetch(`${this.serviceUrl}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Video service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📥 Video service response:', JSON.stringify(result, null, 2));

      if (!result.urlMp4) {
        console.error('❌ Missing urlMp4 in response:', result);
        throw new Error('Video service did not return urlMp4');
      }

      return {
        urlMp4: result.urlMp4,
        urlSrt: result.urlSrt || null,
        urlThumb: result.urlThumb,
        width: result.width,
        height: result.height,
        duration: result.duration,
        size: result.size,
      };
    } catch (error) {
      console.error('❌ Error rendering video:', error);
      throw error;
    }
  }

  async generateThumbnail(videoUrl: string): Promise<string> {
    try {
      const response = await fetch(`${this.serviceUrl}/thumbnail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Thumbnail generation failed: ${response.status}`);
      }

      const result = await response.json();
      return result.thumbnail_url;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      throw error;
    }
  }

  async getVideoInfo(videoUrl: string): Promise<any> {
    // Mock implementation
    return {
      width: 1920,
      height: 1080,
      duration: 30,
      format: 'mp4'
    };
  }
}

export const videoService = new VideoService();
