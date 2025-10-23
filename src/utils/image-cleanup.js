/**
 * Image cleanup utility for managing generated images
 * Automatically removes images older than a specified retention period
 */

const fsPromises = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Default retention period (7 days in milliseconds)
 */
const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Get all image files in a directory
 * @param {string} directory - Directory to scan
 * @returns {Promise<Array>} Array of file objects with name and stats
 */
async function getImageFiles(directory) {
  try {
    const files = await fsPromises.readdir(directory);
    const imageFiles = [];

    for (const file of files) {
      // Only process image files
      if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file)) {
        const filePath = path.join(directory, file);
        try {
          const stats = await fsPromises.stat(filePath);
          imageFiles.push({
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            age: Date.now() - stats.mtime.getTime()
          });
        } catch (statError) {
          logger.warn(`Could not stat file ${file}: ${statError.message}`);
        }
      }
    }

    return imageFiles;
  } catch (error) {
    logger.error(`Error reading directory ${directory}:`, error);
    throw error;
  }
}

/**
 * Clean up old images from a directory
 * @param {string} directory - Directory to clean
 * @param {Object} options - Cleanup options
 * @param {number} options.retentionMs - Maximum age in milliseconds
 * @param {boolean} options.dryRun - If true, don't actually delete files
 * @param {number} options.maxFiles - Maximum number of files to keep (optional)
 * @returns {Promise<Object>} Cleanup results
 */
async function cleanupOldImages(directory, options = {}) {
  const retentionMs = options.retentionMs || DEFAULT_RETENTION_MS;
  const dryRun = options.dryRun || false;
  const maxFiles = options.maxFiles || null;

  logger.info(`Starting image cleanup in ${directory}`);
  logger.info(`Retention period: ${Math.floor(retentionMs / (24 * 60 * 60 * 1000))} days`);
  if (dryRun) {
    logger.info('DRY RUN MODE - No files will be deleted');
  }

  try {
    // Check if directory exists
    try {
      await fsPromises.access(directory);
    } catch (error) {
      logger.warn(`Directory ${directory} does not exist, skipping cleanup`);
      return {
        success: true,
        filesScanned: 0,
        filesDeleted: 0,
        spaceFreed: 0,
        errors: []
      };
    }

    const imageFiles = await getImageFiles(directory);
    logger.info(`Found ${imageFiles.length} image files`);

    // Sort by modification time (oldest first)
    imageFiles.sort((a, b) => a.modified - b.modified);

    const results = {
      success: true,
      filesScanned: imageFiles.length,
      filesDeleted: 0,
      spaceFreed: 0,
      errors: [],
      deletedFiles: []
    };

    // Determine files to delete
    const filesToDelete = [];

    // Delete files older than retention period
    for (const file of imageFiles) {
      if (file.age > retentionMs) {
        filesToDelete.push(file);
      }
    }

    // If maxFiles is set, delete oldest files beyond the limit
    if (maxFiles !== null && imageFiles.length > maxFiles) {
      const excessCount = imageFiles.length - maxFiles;
      const filesNotMarkedForDeletion = imageFiles.filter(f => !filesToDelete.includes(f));

      // Add oldest files that aren't already marked for deletion
      for (let i = 0; i < excessCount && i < filesNotMarkedForDeletion.length; i++) {
        if (!filesToDelete.includes(filesNotMarkedForDeletion[i])) {
          filesToDelete.push(filesNotMarkedForDeletion[i]);
        }
      }
    }

    logger.info(`Identified ${filesToDelete.length} files for deletion`);

    // Delete the files
    for (const file of filesToDelete) {
      try {
        if (!dryRun) {
          await fsPromises.unlink(file.path);
          logger.debug(`Deleted: ${file.name} (${formatBytes(file.size)}, ${Math.floor(file.age / (24 * 60 * 60 * 1000))} days old)`);
        } else {
          logger.debug(`[DRY RUN] Would delete: ${file.name} (${formatBytes(file.size)}, ${Math.floor(file.age / (24 * 60 * 60 * 1000))} days old)`);
        }

        results.filesDeleted++;
        results.spaceFreed += file.size;
        results.deletedFiles.push({
          name: file.name,
          size: file.size,
          age: file.age
        });
      } catch (deleteError) {
        logger.error(`Failed to delete ${file.name}:`, deleteError);
        results.errors.push({
          file: file.name,
          error: deleteError.message
        });
      }
    }

    logger.info(`Cleanup complete: ${results.filesDeleted} files deleted, ${formatBytes(results.spaceFreed)} freed`);

    if (results.errors.length > 0) {
      logger.warn(`Cleanup completed with ${results.errors.length} errors`);
      results.success = false;
    }

    return results;
  } catch (error) {
    logger.error('Error during image cleanup:', error);
    throw error;
  }
}

/**
 * Get statistics about images in a directory
 * @param {string} directory - Directory to analyze
 * @returns {Promise<Object>} Statistics object
 */
async function getImageStats(directory) {
  try {
    const imageFiles = await getImageFiles(directory);

    if (imageFiles.length === 0) {
      return {
        count: 0,
        totalSize: 0,
        oldestFile: null,
        newestFile: null,
        averageAge: 0
      };
    }

    const totalSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
    const totalAge = imageFiles.reduce((sum, file) => sum + file.age, 0);

    imageFiles.sort((a, b) => a.modified - b.modified);

    return {
      count: imageFiles.length,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      oldestFile: {
        name: imageFiles[0].name,
        age: imageFiles[0].age,
        ageDays: Math.floor(imageFiles[0].age / (24 * 60 * 60 * 1000))
      },
      newestFile: {
        name: imageFiles[imageFiles.length - 1].name,
        age: imageFiles[imageFiles.length - 1].age,
        ageDays: Math.floor(imageFiles[imageFiles.length - 1].age / (24 * 60 * 60 * 1000))
      },
      averageAge: totalAge / imageFiles.length,
      averageAgeDays: Math.floor((totalAge / imageFiles.length) / (24 * 60 * 60 * 1000)),
      averageSize: totalSize / imageFiles.length,
      averageSizeFormatted: formatBytes(totalSize / imageFiles.length)
    };
  } catch (error) {
    logger.error('Error getting image stats:', error);
    throw error;
  }
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Schedule automatic cleanup on an interval
 * @param {string} directory - Directory to clean
 * @param {Object} options - Cleanup options
 * @param {number} options.intervalMs - Cleanup interval in milliseconds
 * @param {number} options.retentionMs - Maximum age in milliseconds
 * @returns {Object} Cleanup scheduler with stop() method
 */
function scheduleCleanup(directory, options = {}) {
  const intervalMs = options.intervalMs || 24 * 60 * 60 * 1000; // Default: daily

  logger.info(`Scheduling automatic cleanup every ${Math.floor(intervalMs / (60 * 60 * 1000))} hours`);

  const intervalId = setInterval(async () => {
    try {
      logger.info('Running scheduled image cleanup');
      const results = await cleanupOldImages(directory, options);
      logger.info(`Scheduled cleanup complete: ${results.filesDeleted} files deleted`);
    } catch (error) {
      logger.error('Error in scheduled cleanup:', error);
    }
  }, intervalMs);

  // Run initial cleanup
  cleanupOldImages(directory, options).catch(error => {
    logger.error('Error in initial cleanup:', error);
  });

  return {
    stop: () => {
      clearInterval(intervalId);
      logger.info('Stopped scheduled cleanup');
    }
  };
}

module.exports = {
  cleanupOldImages,
  getImageFiles,
  getImageStats,
  scheduleCleanup,
  formatBytes,
  DEFAULT_RETENTION_MS
};
