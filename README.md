# 🗞️ Autonomous News Anchor System

An AI-powered full-stack system that automatically converts online news articles into summarized, narrated video clips and publishes them to YouTube with minimal human intervention.

---

## 🚀 Project Overview

The **Autonomous News Anchor System** is an end-to-end automated pipeline that:
1. Fetches trending news articles.
2. Generates concise summaries using a transformer-based NLP model.
3. Converts summaries to natural speech using neural Text-to-Speech.
4. Renders videos using FFmpeg.
5. Automatically uploads videos to YouTube.

The system is fully automated using cron scheduling and includes a React-based dashboard for monitoring and manual control.

---

## 🧠 Key Features

- ✅ Automated news ingestion from GNews API  
- ✅ Abstractive summarization using BART-Large-CNN  
- ✅ Neural voice generation using Edge TTS  
- ✅ Video creation using FFmpeg  
- ✅ Auto-publishing to YouTube via API  
- ✅ Cron-based scheduling for 24/7 operation  
- ✅ React dashboard for monitoring and control  
- ✅ PostgreSQL database for job and media tracking  

---

## 🛠️ Tech Stack

**Frontend**
- React.js
- Tailwind CSS
- TypeScript

**Backend**
- Node.js
- Express.js
- TypeScript
- node-cron

**Database**
- PostgreSQL
- Drizzle ORM

**AI & Media**
- Hugging Face API (BART-Large-CNN)
- Edge TTS
- FFmpeg (via fluent-ffmpeg)

**APIs**
- GNews API
- YouTube Data API v3

---

## ⚙️ System Architecture

