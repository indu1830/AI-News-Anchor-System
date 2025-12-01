import cron from 'node-cron';
import { gnewsService } from '../services/gnews';
import { storage } from '../storage';
import type { InsertJob } from '@shared/schema';

class JobScheduler {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private isPaused = false;
  private defaultTopics = [
    "technology",
    "artificial intelligence",
    "climate change", 
    "economy",
    "health",
    "science",
    "global politics"
  ];

  start(): void {
    console.log("Starting job scheduler...");

    // Daily news sync at 8 AM, 2 PM, and 8 PM UTC
    const dailySync = cron.schedule('0 8,14,20 * * *', async () => {
      if (!this.isPaused) {
        await this.performDailySync();
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.cronJobs.set('dailySync', dailySync);

    // Health check every 15 minutes
    const healthCheck = cron.schedule('*/15 * * * *', async () => {
      if (!this.isPaused) {
        await this.performHealthCheck();
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.cronJobs.set('healthCheck', healthCheck);

    // Cleanup old jobs daily at midnight
    const cleanup = cron.schedule('0 0 * * *', async () => {
      await this.cleanupOldJobs();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.cronJobs.set('cleanup', cleanup);

    console.log("Job scheduler started successfully");
  }

  stop(): void {
    console.log("Stopping job scheduler...");
    this.cronJobs.forEach((job, name) => {
      job.destroy();
      console.log(`Stopped cron job: ${name}`);
    });
    this.cronJobs.clear();
    console.log("Job scheduler stopped");
  }

  pauseAutomation(): void {
    this.isPaused = true;
    console.log("Automation paused");
  }

  resumeAutomation(): void {
    this.isPaused = false;
    console.log("Automation resumed");
  }

  async triggerNewsSync(): Promise<void> {
    console.log("Manual news sync triggered");
    await this.performDailySync();
  }

  private async performDailySync(): Promise<void> {
    try {
      console.log("Starting daily news sync...");
      
      const syncPromises = this.defaultTopics.map(async (topic) => {
        try {
          // Check if we already have recent jobs for this topic
          const recentJobs = await storage.getJobsByTopic(topic, 1); // Get jobs from last 1 day
          if (recentJobs.length >= 3) {
            console.log(`Skipping ${topic} - already has ${recentJobs.length} recent jobs`);
            return;
          }

          // Fetch trending articles for this topic
          const articles = await gnewsService.fetchArticles(topic, "en", 5);
          
          if (articles.length === 0) {
            console.log(`No articles found for topic: ${topic}`);
            return;
          }

          // Get existing article hashes to avoid duplicates
          const existingHashes = await storage.getExistingArticleHashes(articles.map(a => 
            this.generateContentHash(a.description)
          ));

          // Filter out duplicates
          const newArticles = articles.filter(article => 
            !existingHashes.includes(this.generateContentHash(article.description))
          );

          if (newArticles.length === 0) {
            console.log(`No new articles for topic: ${topic}`);
            return;
          }

          // Create jobs for new articles (limit to 2 per topic per sync)
          const articlesToProcess = newArticles.slice(0, 2);
          
          for (const article of articlesToProcess) {
            const jobData: InsertJob = {
              topic: topic,
              language: "en",
              targetLength: this.getRandomTargetLength(),
              autoPublish: true,
              status: "queued",
              progress: 0,
              steps: [],
            };

            const job = await storage.createJob(jobData);
            console.log(`Created job ${job.id} for topic: ${topic}`);
            
            // Add small delay between job creations
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.error(`Error processing topic ${topic}:`, error);
        }
      });

      await Promise.allSettled(syncPromises);
      console.log("Daily news sync completed");

    } catch (error) {
      console.error("Error in daily sync:", error);
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check for stuck jobs (running for more than 30 minutes)
      const stuckJobs = await storage.getStuckJobs(30); // 30 minutes
      
      for (const job of stuckJobs) {
        console.log(`Found stuck job: ${job.id}, resetting to failed`);
        await storage.updateJobStatus(job.id, "failed", "Job timed out");
      }

      // Log system stats
      const metrics = await storage.getMetrics();
      console.log(`Health check - Active jobs: ${metrics.activeJobs}, Success rate: ${metrics.successRate}%`);

    } catch (error) {
      console.error("Error in health check:", error);
    }
  }

  private async cleanupOldJobs(): Promise<void> {
    try {
      console.log("Starting job cleanup...");
      
      // Delete jobs older than 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      
      const deletedCount = await storage.deleteJobsOlderThan(cutoffDate);
      console.log(`Cleaned up ${deletedCount} old jobs`);

    } catch (error) {
      console.error("Error in cleanup:", error);
    }
  }

  private generateContentHash(content: string): string {
    // Simple hash function - in production, use crypto
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private getRandomTargetLength(): number {
    const lengths = [60, 90, 120]; // seconds
    return lengths[Math.floor(Math.random() * lengths.length)];
  }
}

export const scheduler = new JobScheduler();
