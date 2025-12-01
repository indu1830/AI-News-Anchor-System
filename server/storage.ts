import { 
  jobs, 
  articles, 
  summaries, 
  audioFiles, 
  videos, 
  publications, 
  users,
  type Job, 
  type InsertJob,
  type Article,
  type InsertArticle,
  type Summary,
  type InsertSummary,
  type AudioFile,
  type InsertAudioFile,
  type Video,
  type InsertVideo,
  type Publication,
  type InsertPublication,
  type User, 
  type InsertUser 
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, inArray, sql, count } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Job methods
  getJobs(params: { page: number; limit: number; filters?: any }): Promise<{ data: Job[]; total: number; page: number; limit: number; totalPages: number }>;
  getJobById(id: string): Promise<Job | undefined>;
  getJobsByTopic(topic: string, daysSince?: number): Promise<Job[]>;
  getStuckJobs(minutesThreshold: number): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJobStatus(id: string, status: string, error?: string | null, progress?: number): Promise<void>;
  deleteJob(id: string): Promise<void>;
  deleteJobsOlderThan(date: Date): Promise<number>;

  // Article methods
  getArticleByJobId(jobId: string): Promise<Article | undefined>;
  createArticle(article: InsertArticle): Promise<Article>;
  getExistingArticleHashes(hashes: string[]): Promise<string[]>;

  // Summary methods
  getSummaryByJobId(jobId: string): Promise<Summary | undefined>;
  createSummary(summary: InsertSummary): Promise<Summary>;

  // Audio methods
  getAudioByJobId(jobId: string): Promise<AudioFile | undefined>;
  createAudio(audio: InsertAudioFile): Promise<AudioFile>;

  // Video methods
  getVideoByJobId(jobId: string): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;

  // Publication methods
  createPublication(publication: InsertPublication): Promise<Publication>;

  // Metrics
  getMetrics(): Promise<{
    jobsToday: number;
    successRate: number;
    avgRenderTime: string;
    published: number;
    activeJobs: number;
    totalJobs: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getJobs(params: { page: number; limit: number; filters?: any }) {
    const { page, limit, filters = {} } = params;
    const offset = (page - 1) * limit;

    // Build where conditions
    let whereConditions = [];
    
    if (filters.status) {
      whereConditions.push(eq(jobs.status, filters.status));
    }
    if (filters.topic) {
      whereConditions.push(sql`${jobs.topic} ILIKE ${`%${filters.topic}%`}`);
    }
    if (filters.language) {
      whereConditions.push(eq(jobs.language, filters.language));
    }
    if (filters.dateFrom) {
      whereConditions.push(gte(jobs.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      whereConditions.push(lte(jobs.createdAt, new Date(filters.dateTo)));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(jobs)
      .where(whereClause);

    // Get paginated jobs
    const jobsData = await db
      .select()
      .from(jobs)
      .where(whereClause)
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: jobsData,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async getJobById(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async getJobsByTopic(topic: string, daysSince = 1): Promise<Job[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSince);

    return await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.topic, topic),
        gte(jobs.createdAt, cutoffDate)
      ))
      .orderBy(desc(jobs.createdAt));
  }

  async getStuckJobs(minutesThreshold: number): Promise<Job[]> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutesThreshold);

    return await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.status, "running"),
        lte(jobs.updatedAt, cutoffTime)
      ));
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [newJob] = await db
      .insert(jobs)
      .values({
        ...job,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return newJob;
  }

  async updateJobStatus(id: string, status: string, error?: string | null, progress?: number): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (error !== undefined) {
      updateData.error = error;
    }
    if (progress !== undefined) {
      updateData.progress = progress;
    }

    await db
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, id));
  }

  async deleteJob(id: string): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async deleteJobsOlderThan(date: Date): Promise<number> {
    const result = await db
      .delete(jobs)
      .where(lte(jobs.createdAt, date))
      .returning({ id: jobs.id });
    
    return result.length;
  }

  async getArticleByJobId(jobId: string): Promise<Article | undefined> {
    const [article] = await db.select().from(articles).where(eq(articles.jobId, jobId));
    return article || undefined;
  }

  async createArticle(article: InsertArticle): Promise<Article> {
    const [newArticle] = await db
      .insert(articles)
      .values({
        ...article,
        createdAt: new Date(),
      })
      .returning();
    return newArticle;
  }

  async getExistingArticleHashes(hashes: string[]): Promise<string[]> {
    if (hashes.length === 0) return [];
    
    const existing = await db
      .select({ contentHash: articles.contentHash })
      .from(articles)
      .where(inArray(articles.contentHash, hashes));
    
    return existing.map(a => a.contentHash);
  }

  async getSummaryByJobId(jobId: string): Promise<Summary | undefined> {
    const [summary] = await db.select().from(summaries).where(eq(summaries.jobId, jobId));
    return summary || undefined;
  }

  async createSummary(summary: InsertSummary): Promise<Summary> {
    const [newSummary] = await db
      .insert(summaries)
      .values({
        ...summary,
        createdAt: new Date(),
      })
      .returning();
    return newSummary;
  }

  async getAudioByJobId(jobId: string): Promise<AudioFile | undefined> {
    const [audio] = await db.select().from(audioFiles).where(eq(audioFiles.jobId, jobId));
    return audio || undefined;
  }

  async createAudio(audio: InsertAudioFile): Promise<AudioFile> {
    const [newAudio] = await db
      .insert(audioFiles)
      .values({
        ...audio,
        createdAt: new Date(),
      })
      .returning();
    return newAudio;
  }

  async getVideoByJobId(jobId: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.jobId, jobId));
    return video || undefined;
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const [newVideo] = await db
      .insert(videos)
      .values({
        ...video,
        createdAt: new Date(),
      })
      .returning();
    return newVideo;
  }

  async createPublication(publication: InsertPublication): Promise<Publication> {
    const [newPublication] = await db
      .insert(publications)
      .values({
        ...publication,
        createdAt: new Date(),
      })
      .returning();
    return newPublication;
  }

  async getMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Jobs today
    const [{ count: jobsToday }] = await db
      .select({ count: count() })
      .from(jobs)
      .where(gte(jobs.createdAt, today));

    // Total jobs
    const [{ count: totalJobs }] = await db
      .select({ count: count() })
      .from(jobs);

    // Success rate (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [{ count: totalRecent }] = await db
      .select({ count: count() })
      .from(jobs)
      .where(gte(jobs.createdAt, thirtyDaysAgo));

    const [{ count: successfulRecent }] = await db
      .select({ count: count() })
      .from(jobs)
      .where(and(
        gte(jobs.createdAt, thirtyDaysAgo),
        eq(jobs.status, "completed")
      ));

    const successRate = totalRecent > 0 ? (successfulRecent / totalRecent) * 100 : 0;

    // Active jobs
    const [{ count: activeJobs }] = await db
      .select({ count: count() })
      .from(jobs)
      .where(eq(jobs.status, "running"));

    // Published today
    const [{ count: published }] = await db
      .select({ count: count() })
      .from(publications)
      .where(gte(publications.createdAt, today));

    return {
      jobsToday,
      successRate: Math.round(successRate * 10) / 10,
      avgRenderTime: "2.4m", // This would need actual calculation from job timestamps
      published,
      activeJobs,
      totalJobs,
    };
  }
}

export const storage = new DatabaseStorage();
