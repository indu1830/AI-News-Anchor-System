import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Explicitly load .env file
config();

export default defineConfig({
  schema: './shared/schema.ts', // Adjust this path to match your schema location
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
