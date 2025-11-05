#!/usr/bin/env node

/**
 * Flux Setup Script
 * Automatically creates .env file from .env.example if needed
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function setupEnv() {
  const envPath = join(rootDir, '.env');
  const envExamplePath = join(rootDir, '.env.example');
  
  // If .env already exists, check if it has a real API key
  if (existsSync(envPath)) {
    try {
      const envContent = await readFile(envPath, 'utf-8');
      const hasTmdbKey = envContent.includes('VITE_TMDB_API_KEY=') && 
                         !envContent.includes('VITE_TMDB_API_KEY=your_') &&
                         envContent.split('VITE_TMDB_API_KEY=')[1]?.split('\n')[0]?.trim().length > 10;
      
      if (hasTmdbKey) {
        // API key is configured, all good!
        return true;
      }
    } catch (error) {
      // Couldn't read file, will try to create
    }
  }
  
  // Create .env from .env.example if it doesn't exist
  if (!existsSync(envPath) && existsSync(envExamplePath)) {
    try {
      const exampleContent = await readFile(envExamplePath, 'utf-8');
      writeFileSync(envPath, exampleContent);
      console.log('\n📝 Created .env file - Add your API key to get started!');
      console.log('   Get free key: https://www.themoviedb.org/settings/api\n');
      return false;
    } catch (error) {
      // Silent fail
    }
  }
  
  return false;
}

// Run setup (non-blocking for postinstall)
setupEnv().catch(() => {
  // Silent fail for postinstall
});
