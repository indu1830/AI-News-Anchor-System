import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const youtube = google.youtube('v3');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface YouTubeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

class YouTubeService {
  private oauth2Client: any;
  private config: YouTubeConfig;
  private tokenPath = path.join(__dirname, '../../youtube-tokens.json');

  constructor() {
    this.config = {
      clientId: process.env.YOUTUBE_CLIENT_ID || '',
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
      redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:5000/api/youtube/oauth-callback',
    };

    this.oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    // Load saved tokens
    this.loadTokens();
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Handle OAuth callback and save tokens
   */
  async handleCallback(code: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      await this.saveTokens(tokens);
      console.log('✅ YouTube OAuth tokens saved successfully');
    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      throw error;
    }
  }

  /**
   * Upload video to YouTube
   */
  async uploadVideo(
    videoUrl: string,
    title: string,
    description: string,
    tags: string[] = []
  ): Promise<string> {
    try {
      console.log('📤 Uploading video to YouTube...');
      console.log(`   Title: ${title}`);
      console.log(`   Video URL: ${videoUrl}`);

      // Download video file
      const videoPath = await this.downloadVideo(videoUrl);

      const videoFileSize = fs.statSync(videoPath).size;
      console.log(`   Video size: ${(videoFileSize / 1024 / 1024).toFixed(2)} MB`);

      // Upload to YouTube
      const response = await youtube.videos.insert({
        auth: this.oauth2Client,
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: title,
            description: description,
            tags: tags,
            categoryId: '25', // News & Politics
          },
          status: {
            privacyStatus: 'public', // or 'private', 'unlisted'
          },
        },
        media: {
          body: fs.createReadStream(videoPath),
        },
      });

      // Clean up temp file
      fs.unlinkSync(videoPath);

      const videoId = response.data.id;
      console.log(`✅ Video uploaded! ID: ${videoId}`);
      console.log(`   URL: https://www.youtube.com/watch?v=${videoId}`);

      return videoId!;
    } catch (error) {
      console.error('❌ YouTube upload error:', error);
      throw error;
    }
  }

  /**
   * Download video from URL
   */
  private async downloadVideo(url: string): Promise<string> {
    const tempPath = path.join(__dirname, `../../temp_video_${Date.now()}.mp4`);
    
    console.log('   Downloading video for upload...');
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(tempPath));
      writer.on('error', reject);
    });
  }

  /**
   * Save tokens to file
   */
  private async saveTokens(tokens: any): Promise<void> {
    await fs.promises.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
  }

  /**
   * Load tokens from file
   */
  private async loadTokens(): Promise<void> {
    try {
      if (fs.existsSync(this.tokenPath)) {
        const tokens = JSON.parse(await fs.promises.readFile(this.tokenPath, 'utf-8'));
        this.oauth2Client.setCredentials(tokens);
        console.log('✅ YouTube tokens loaded from file');
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('⚠️ Could not load YouTube tokens:', error.message);
      } else {
        console.warn('⚠️ Could not load YouTube tokens:', error);
      }
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    const credentials = this.oauth2Client.credentials;
    return !!(credentials && credentials.access_token);
  }

  /**
   * Get service status
   */
  async checkStatus(): Promise<{ status: string; message?: string }> {
    if (!this.config.clientId || !this.config.clientSecret) {
      return { status: 'down', message: 'OAuth credentials not configured' };
    }

    if (!this.isAuthenticated()) {
      return { status: 'degraded', message: 'Authentication required' };
    }

    return { status: 'operational' };
  }

  /**
   * Publish video (for routes.ts)
   */
  async publishVideo(job: any, video: any): Promise<any> {
    const videoUrl = video.urlMp4;
    const title = `${job.topic} - AutoNews Summary`;
    const description = `Automated news summary about ${job.topic}\n\nGenerated by AutoNews AI`;
    const tags = [job.topic, 'news', 'AI summary', 'AutoNews'];

    const videoId = await this.uploadVideo(videoUrl, title, description, tags);

    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: new Date(),
    };
  }
}

export const youtubeService = new YouTubeService();
