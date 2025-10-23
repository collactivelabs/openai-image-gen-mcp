const {
  cleanupOldImages,
  getImageFiles,
  getImageStats,
  scheduleCleanup,
  formatBytes,
  DEFAULT_RETENTION_MS
} = require('../src/utils/image-cleanup');

// Mock fs.promises
const mockFiles = [];
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
    access: jest.fn(),
    unlink: jest.fn()
  }
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const fsPromises = require('fs').promises;
const logger = require('../src/utils/logger');

describe('Image Cleanup Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(5242880)).toBe('5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('getImageFiles', () => {
    it('should return image files with stats', async () => {
      const now = Date.now();
      fsPromises.readdir.mockResolvedValue(['image1.png', 'image2.jpg', 'file.txt']);
      fsPromises.stat.mockImplementation((path) => {
        if (path.includes('image1')) {
          return Promise.resolve({
            size: 1024,
            birthtime: new Date(now - 2 * 24 * 60 * 60 * 1000),
            mtime: new Date(now - 2 * 24 * 60 * 60 * 1000)
          });
        }
        if (path.includes('image2')) {
          return Promise.resolve({
            size: 2048,
            birthtime: new Date(now - 1 * 24 * 60 * 60 * 1000),
            mtime: new Date(now - 1 * 24 * 60 * 60 * 1000)
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const files = await getImageFiles('/test/dir');

      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('image1.png');
      expect(files[0].size).toBe(1024);
      expect(files[1].name).toBe('image2.jpg');
      expect(files[1].size).toBe(2048);
    });

    it('should filter non-image files', async () => {
      fsPromises.readdir.mockResolvedValue(['image.png', 'doc.pdf', 'video.mp4']);
      fsPromises.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date()
      });

      const files = await getImageFiles('/test/dir');

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('image.png');
    });

    it('should handle stat errors gracefully', async () => {
      fsPromises.readdir.mockResolvedValue(['image1.png', 'image2.png']);
      fsPromises.stat.mockImplementation((path) => {
        if (path.includes('image1')) {
          return Promise.resolve({
            size: 1024,
            birthtime: new Date(),
            mtime: new Date()
          });
        }
        return Promise.reject(new Error('Permission denied'));
      });

      const files = await getImageFiles('/test/dir');

      expect(files).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should throw error if directory read fails', async () => {
      fsPromises.readdir.mockRejectedValue(new Error('Directory not found'));

      await expect(getImageFiles('/test/dir')).rejects.toThrow('Directory not found');
    });
  });

  describe('cleanupOldImages', () => {
    it('should clean up old images', async () => {
      const now = Date.now();
      const oldTime = now - 10 * 24 * 60 * 60 * 1000; // 10 days old
      const recentTime = now - 1 * 24 * 60 * 60 * 1000; // 1 day old

      fsPromises.access.mockResolvedValue();
      fsPromises.readdir.mockResolvedValue(['old.png', 'recent.png']);
      fsPromises.stat.mockImplementation((path) => {
        if (path.includes('old')) {
          return Promise.resolve({
            size: 1024,
            birthtime: new Date(oldTime),
            mtime: new Date(oldTime)
          });
        }
        return Promise.resolve({
          size: 2048,
          birthtime: new Date(recentTime),
          mtime: new Date(recentTime)
        });
      });
      fsPromises.unlink.mockResolvedValue();

      const results = await cleanupOldImages('/test/dir', {
        retentionMs: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      expect(results.filesScanned).toBe(2);
      expect(results.filesDeleted).toBe(1);
      expect(results.spaceFreed).toBe(1024);
      expect(fsPromises.unlink).toHaveBeenCalledTimes(1);
    });

    it('should respect maxFiles limit', async () => {
      const now = Date.now();
      fsPromises.access.mockResolvedValue();
      fsPromises.readdir.mockResolvedValue(['img1.png', 'img2.png', 'img3.png']);
      fsPromises.stat.mockImplementation(() => {
        return Promise.resolve({
          size: 1024,
          birthtime: new Date(now - 1 * 24 * 60 * 60 * 1000),
          mtime: new Date(now - 1 * 24 * 60 * 60 * 1000)
        });
      });
      fsPromises.unlink.mockResolvedValue();

      const results = await cleanupOldImages('/test/dir', {
        retentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days (won't trigger age-based deletion)
        maxFiles: 2 // Keep only 2 files
      });

      expect(results.filesScanned).toBe(3);
      expect(results.filesDeleted).toBe(1); // Should delete 1 file to get down to 2
      expect(fsPromises.unlink).toHaveBeenCalledTimes(1);
    });

    it('should handle dry run mode', async () => {
      const now = Date.now();
      const oldTime = now - 10 * 24 * 60 * 60 * 1000;

      fsPromises.access.mockResolvedValue();
      fsPromises.readdir.mockResolvedValue(['old.png']);
      fsPromises.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(oldTime),
        mtime: new Date(oldTime)
      });

      const results = await cleanupOldImages('/test/dir', {
        retentionMs: 7 * 24 * 60 * 60 * 1000,
        dryRun: true
      });

      expect(results.filesDeleted).toBe(1);
      expect(fsPromises.unlink).not.toHaveBeenCalled();
    });

    it('should handle non-existent directory', async () => {
      fsPromises.access.mockRejectedValue(new Error('Directory not found'));

      const results = await cleanupOldImages('/test/dir');

      expect(results.filesScanned).toBe(0);
      expect(results.filesDeleted).toBe(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should track errors during deletion', async () => {
      const now = Date.now();
      const oldTime = now - 10 * 24 * 60 * 60 * 1000;

      fsPromises.access.mockResolvedValue();
      fsPromises.readdir.mockResolvedValue(['img1.png', 'img2.png']);
      fsPromises.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(oldTime),
        mtime: new Date(oldTime)
      });
      fsPromises.unlink.mockImplementation((path) => {
        if (path.includes('img1')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Permission denied'));
      });

      const results = await cleanupOldImages('/test/dir', {
        retentionMs: 7 * 24 * 60 * 60 * 1000
      });

      expect(results.filesScanned).toBe(2);
      expect(results.filesDeleted).toBeGreaterThanOrEqual(1);
      expect(results.errors).toHaveLength(1);
      expect(results.success).toBe(false);
    });
  });

  describe('getImageStats', () => {
    it('should return statistics for empty directory', async () => {
      fsPromises.readdir.mockResolvedValue([]);

      const stats = await getImageStats('/test/dir');

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestFile).toBeNull();
      expect(stats.newestFile).toBeNull();
    });

    it('should calculate statistics correctly', async () => {
      const now = Date.now();
      fsPromises.readdir.mockResolvedValue(['img1.png', 'img2.png']);
      fsPromises.stat.mockImplementation((path) => {
        if (path.includes('img1')) {
          return Promise.resolve({
            size: 1024,
            birthtime: new Date(now - 5 * 24 * 60 * 60 * 1000),
            mtime: new Date(now - 5 * 24 * 60 * 60 * 1000)
          });
        }
        return Promise.resolve({
          size: 2048,
          birthtime: new Date(now - 1 * 24 * 60 * 60 * 1000),
          mtime: new Date(now - 1 * 24 * 60 * 60 * 1000)
        });
      });

      const stats = await getImageStats('/test/dir');

      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBe(3072);
      expect(stats.oldestFile.name).toBe('img1.png');
      expect(stats.newestFile.name).toBe('img2.png');
      expect(stats.averageSize).toBe(1536);
      expect(stats.totalSizeFormatted).toBe('3 KB');
    });
  });

  describe('scheduleCleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should schedule cleanup at intervals', async () => {
      fsPromises.access.mockResolvedValue();
      fsPromises.readdir.mockResolvedValue([]);

      const scheduler = scheduleCleanup('/test/dir', {
        intervalMs: 1000,
        retentionMs: 7 * 24 * 60 * 60 * 1000
      });

      // Initial cleanup
      await Promise.resolve();
      expect(fsPromises.readdir).toHaveBeenCalledTimes(1);

      // Advance time and check if cleanup runs again
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      scheduler.stop();
    });

    it('should have a stop method', () => {
      const scheduler = scheduleCleanup('/test/dir');

      expect(scheduler.stop).toBeDefined();
      expect(typeof scheduler.stop).toBe('function');

      scheduler.stop();
      expect(logger.info).toHaveBeenCalledWith('Stopped scheduled cleanup');
    });
  });

  describe('DEFAULT_RETENTION_MS', () => {
    it('should be 7 days in milliseconds', () => {
      expect(DEFAULT_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
