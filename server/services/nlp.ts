export class HuggingFaceNLP {
  private apiKey: string;
  private baseUrl = 'https://router.huggingface.co/hf-inference';
  private model = 'facebook/bart-large-cnn';
  private maxRetries = 5;
  private initialTimeout = 30000;
  
  // Health check caching
  private lastHealthCheck: boolean = true;
  private lastHealthCheckTime: number = 0;
  private healthCheckCacheDuration: number = 60000; // 1 minute

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
  }

  /**
   * Summarize text with retry logic
   */
  async summarize(text: string, maxLength: number = 200): Promise<string> {
    if (!this.apiKey) {
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const timeout = this.initialTimeout * attempt;
        console.log(`Attempt ${attempt}/${this.maxRetries} - Timeout: ${timeout}ms`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(
          `${this.baseUrl}/models/${this.model}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: text,
              parameters: {
                max_length: maxLength,
                min_length: 50,
                do_sample: false,
              },
              options: {
                wait_for_model: true,
                use_cache: false,
              }
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.text();
          
          if (response.status === 504 && attempt < this.maxRetries) {
            console.warn(`504 timeout on attempt ${attempt}, retrying...`);
            await this.sleep(2000 * attempt);
            continue;
          }
          
          throw new Error(`Hugging Face API error: ${response.status} - ${error.substring(0, 200)}`);
        }

        const result = await response.json();
        
        if (result.error) {
          throw new Error(`Summarization error: ${result.error}`);
        }
        
        if (Array.isArray(result) && result[0]?.summary_text) {
          return result[0].summary_text;
        }
        
        if (result.summary_text) {
          return result.summary_text;
        }
        
        throw new Error('Unexpected response format');
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (error instanceof Error && error.name === 'AbortError' && attempt < this.maxRetries) {
          console.warn(`Request timeout on attempt ${attempt}, retrying...`);
          await this.sleep(2000 * attempt);
          continue;
        }
        
        if (attempt === this.maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Failed to generate summary after retries');
  }

  /**
   * Check if service is available (with caching)
   */
  async checkHealth(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    // Return cached result if recent
    const now = Date.now();
    if (now - this.lastHealthCheckTime < this.healthCheckCacheDuration) {
      return this.lastHealthCheck;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `${this.baseUrl}/models/${this.model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: 'health check test',
            parameters: { max_length: 20, min_length: 10 },
            options: { wait_for_model: true, use_cache: true }
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      
      // Update cache
      this.lastHealthCheck = response.ok;
      this.lastHealthCheckTime = now;
      
      return response.ok;
      
    } catch (error) {
      // On timeout, return last known good status
      if (error instanceof Error && error.name === 'AbortError' && this.lastHealthCheck) {
        console.warn('NLP health check timeout - using cached status');
        return this.lastHealthCheck;
      }
      
      this.lastHealthCheck = false;
      this.lastHealthCheckTime = now;
      return false;
    }
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const nlpService = new HuggingFaceNLP();
