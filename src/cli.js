#!/usr/bin/env node

/**
 * CLI tool for OpenAI Image Generation MCP
 * Provides command-line management of images and services
 */

const { Command } = require('commander');
const { getImageStats, cleanupOldImages, formatBytes } = require('./utils/image-cleanup');
const { validateConfig } = require('./utils/config');
const path = require('path');

// Try to load dotenv from project root
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (error) {
  // Continue without dotenv
}

const program = new Command();

program
  .name('openai-image-gen-mcp')
  .description('CLI tool for managing OpenAI Image Generation MCP')
  .version('1.0.0');

// Stats command
program
  .command('stats')
  .description('Display statistics about generated images')
  .option('-d, --directory <path>', 'Images directory', './generated-images')
  .action(async (options) => {
    try {
      const dir = path.resolve(options.directory);
      console.log(`\nImage Statistics for ${dir}\n`);

      const stats = await getImageStats(dir);

      if (stats.count === 0) {
        console.log('No images found.');
        return;
      }

      console.log(`Total Images: ${stats.count}`);
      console.log(`Total Size: ${stats.totalSizeFormatted}`);
      console.log(`Average Size: ${stats.averageSizeFormatted}`);
      console.log(`\nOldest Image:`);
      console.log(`  Name: ${stats.oldestFile.name}`);
      console.log(`  Age: ${stats.oldestFile.ageDays} days`);
      console.log(`\nNewest Image:`);
      console.log(`  Name: ${stats.newestFile.name}`);
      console.log(`  Age: ${stats.newestFile.ageDays} days`);
      console.log(`\nAverage Age: ${stats.averageAgeDays} days\n`);
    } catch (error) {
      console.error('Error getting stats:', error.message);
      process.exit(1);
    }
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean up old generated images')
  .option('-d, --directory <path>', 'Images directory', './generated-images')
  .option('-r, --retention <days>', 'Retention period in days', '7')
  .option('-m, --max <count>', 'Maximum number of images to keep')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async (options) => {
    try {
      const dir = path.resolve(options.directory);
      const retentionDays = parseInt(options.retention, 10);
      const maxFiles = options.max ? parseInt(options.max, 10) : null;
      const dryRun = options.dryRun || false;

      console.log(`\nCleaning up images in ${dir}`);
      console.log(`Retention period: ${retentionDays} days`);
      if (maxFiles) {
        console.log(`Max files: ${maxFiles}`);
      }
      if (dryRun) {
        console.log('DRY RUN MODE - No files will be deleted\n');
      }

      const results = await cleanupOldImages(dir, {
        retentionMs: retentionDays * 24 * 60 * 60 * 1000,
        maxFiles,
        dryRun
      });

      console.log(`\nCleanup Results:`);
      console.log(`Files scanned: ${results.filesScanned}`);
      console.log(`Files deleted: ${results.filesDeleted}`);
      console.log(`Space freed: ${formatBytes(results.spaceFreed)}`);

      if (results.errors.length > 0) {
        console.log(`\nErrors (${results.errors.length}):`);
        results.errors.forEach(err => {
          console.log(`  ${err.file}: ${err.error}`);
        });
      }

      if (dryRun && results.filesDeleted > 0) {
        console.log(`\nRun without --dry-run to actually delete these files.`);
      }

      console.log('');
    } catch (error) {
      console.error('Error during cleanup:', error.message);
      process.exit(1);
    }
  });

// Config validation command
program
  .command('validate-config')
  .description('Validate configuration and API key')
  .option('--skip-api-check', 'Skip OpenAI API key validation')
  .action(async (options) => {
    try {
      console.log('\nValidating configuration...\n');

      const config = await validateConfig({
        validateApiKey: !options.skipApiCheck,
        exitOnError: false
      });

      console.log('Configuration is valid!');
      console.log(`\nAPI Key: ${config.apiKey.substring(0, 10)}...`);
      console.log(`Port: ${config.port}`);
      console.log(`Auth Token: ${config.authToken ? 'Set' : 'Not set'}`);
      console.log(`Output Dir: ${config.outputDir}`);
      console.log(`Log Level: ${config.logLevel}`);
      console.log(`Image Cleanup: ${config.imageCleanupEnabled ? 'Enabled' : 'Disabled'}`);

      if (config.imageCleanupEnabled) {
        console.log(`  Retention: ${config.imageRetentionDays} days`);
        console.log(`  Max Files: ${config.imageMaxCount || 'Unlimited'}`);
        console.log(`  Interval: ${config.imageCleanupIntervalHours} hours`);
      }

      console.log('');
    } catch (error) {
      console.error('Configuration validation failed:', error.message);
      process.exit(1);
    }
  });

// Generate command (quick image generation)
program
  .command('generate <prompt>')
  .description('Generate an image from command line')
  .option('-m, --model <model>', 'Model to use (dall-e-2 or dall-e-3)', 'dall-e-3')
  .option('-s, --size <size>', 'Image size', '1024x1024')
  .option('-q, --quality <quality>', 'Image quality (standard or hd)', 'standard')
  .option('--style <style>', 'Image style (vivid or natural)', 'vivid')
  .option('--no-save', 'Do not save image locally')
  .action(async (prompt, options) => {
    try {
      console.log('\nGenerating image...\n');

      // Initialize the image gen class
      const OpenAIImageGenMCP = require('./openai-image-gen');
      const config = await validateConfig({
        validateApiKey: false,
        exitOnError: false
      });

      const imageGen = new OpenAIImageGenMCP(config.apiKey);

      const params = {
        prompt,
        model: options.model,
        size: options.size,
        quality: options.quality,
        style: options.style
      };

      let result;
      if (options.save) {
        result = await imageGen.generateAndSaveImage(prompt, params);
        console.log(`Image generated and saved!`);
        console.log(`File: ${result.filePath}`);
      } else {
        const data = await imageGen.generateImage(prompt, params);
        result = data[0];
        console.log(`Image generated!`);
      }

      console.log(`URL: ${result.url}`);
      if (result.revised_prompt) {
        console.log(`\nRevised prompt: ${result.revised_prompt}`);
      }
      console.log('');
    } catch (error) {
      console.error('Error generating image:', error.message);
      process.exit(1);
    }
  });

// List images command
program
  .command('list')
  .description('List all generated images')
  .option('-d, --directory <path>', 'Images directory', './generated-images')
  .option('-l, --limit <count>', 'Limit number of results', '20')
  .option('--sort <field>', 'Sort by (name, size, age)', 'age')
  .action(async (options) => {
    try {
      const { getImageFiles } = require('./utils/image-cleanup');
      const dir = path.resolve(options.directory);
      const limit = parseInt(options.limit, 10);

      const files = await getImageFiles(dir);

      if (files.length === 0) {
        console.log('\nNo images found.\n');
        return;
      }

      // Sort files
      if (options.sort === 'size') {
        files.sort((a, b) => b.size - a.size);
      } else if (options.sort === 'name') {
        files.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        files.sort((a, b) => b.age - a.age); // Oldest first
      }

      console.log(`\nListing ${Math.min(limit, files.length)} of ${files.length} images:\n`);

      const displayFiles = files.slice(0, limit);
      displayFiles.forEach((file, index) => {
        const ageDays = Math.floor(file.age / (24 * 60 * 60 * 1000));
        console.log(`${index + 1}. ${file.name}`);
        console.log(`   Size: ${formatBytes(file.size)} | Age: ${ageDays} days`);
      });

      console.log('');
    } catch (error) {
      console.error('Error listing images:', error.message);
      process.exit(1);
    }
  });

program.parse();
