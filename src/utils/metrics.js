/**
 * Metrics collection and reporting utilities
 * Provides Prometheus-compatible metrics for monitoring
 */

const logger = require('./logger');

/**
 * Metrics store
 */
class MetricsStore {
  constructor() {
    this.startTime = Date.now();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
  }

  /**
   * Increment a counter metric
   * @param {string} name - Metric name
   * @param {number} value - Value to add (default: 1)
   * @param {Object} labels - Optional labels
   */
  incrementCounter(name, value = 1, labels = {}) {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || { name, value: 0, labels };
    current.value += value;
    this.counters.set(key, current);
  }

  /**
   * Set a gauge metric
   * @param {string} name - Metric name
   * @param {number} value - Gauge value
   * @param {Object} labels - Optional labels
   */
  setGauge(name, value, labels = {}) {
    const key = this.getKey(name, labels);
    this.gauges.set(key, { name, value, labels });
  }

  /**
   * Record a histogram value (for latencies, sizes, etc.)
   * @param {string} name - Metric name
   * @param {number} value - Value to record
   * @param {Object} labels - Optional labels
   */
  recordHistogram(name, value, labels = {}) {
    const key = this.getKey(name, labels);
    const hist = this.histograms.get(key) || {
      name,
      labels,
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      values: []
    };

    hist.count++;
    hist.sum += value;
    hist.min = Math.min(hist.min, value);
    hist.max = Math.max(hist.max, value);
    hist.values.push(value);

    // Keep only last 1000 values to prevent memory issues
    if (hist.values.length > 1000) {
      hist.values.shift();
    }

    this.histograms.set(key, hist);
  }

  /**
   * Get key for storing metrics with labels
   * @private
   */
  getKey(name, labels) {
    const labelStr = Object.keys(labels)
      .sort()
      .map(k => `${k}="${labels[k]}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Get all metrics as JSON
   */
  getMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      counters: Array.from(this.counters.values()),
      gauges: Array.from(this.gauges.values()),
      histograms: Array.from(this.histograms.values()).map(h => ({
        name: h.name,
        labels: h.labels,
        count: h.count,
        sum: h.sum,
        min: h.min,
        max: h.max,
        avg: h.sum / h.count,
        p50: this.percentile(h.values, 0.5),
        p95: this.percentile(h.values, 0.95),
        p99: this.percentile(h.values, 0.99)
      }))
    };

    return metrics;
  }

  /**
   * Calculate percentile from sorted array
   * @private
   */
  percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get metrics in Prometheus text format
   */
  getPrometheusMetrics() {
    const lines = [];

    // Add uptime
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${(Date.now() - this.startTime) / 1000}`);
    lines.push('');

    // Add counters
    for (const counter of this.counters.values()) {
      const labelStr = this.formatLabels(counter.labels);
      lines.push(`# HELP ${counter.name} Counter metric`);
      lines.push(`# TYPE ${counter.name} counter`);
      lines.push(`${counter.name}${labelStr} ${counter.value}`);
      lines.push('');
    }

    // Add gauges
    for (const gauge of this.gauges.values()) {
      const labelStr = this.formatLabels(gauge.labels);
      lines.push(`# HELP ${gauge.name} Gauge metric`);
      lines.push(`# TYPE ${gauge.name} gauge`);
      lines.push(`${gauge.name}${labelStr} ${gauge.value}`);
      lines.push('');
    }

    // Add histograms
    for (const hist of this.histograms.values()) {
      const labelStr = this.formatLabels(hist.labels);
      lines.push(`# HELP ${hist.name} Histogram metric`);
      lines.push(`# TYPE ${hist.name} histogram`);
      lines.push(`${hist.name}_count${labelStr} ${hist.count}`);
      lines.push(`${hist.name}_sum${labelStr} ${hist.sum}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format labels for Prometheus
   * @private
   */
  formatLabels(labels) {
    const keys = Object.keys(labels);
    if (keys.length === 0) return '';
    const labelPairs = keys
      .map(k => `${k}="${labels[k]}"`)
      .join(',');
    return `{${labelPairs}}`;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

// Singleton instance
const metrics = new MetricsStore();

/**
 * Express middleware to track request metrics
 */
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();

  // Increment request counter
  metrics.incrementCounter('http_requests_total', 1, {
    method: req.method,
    path: req.route ? req.route.path : req.path
  });

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Record response time
    metrics.recordHistogram('http_request_duration_ms', duration, {
      method: req.method,
      path: req.route ? req.route.path : req.path,
      status: res.statusCode.toString()
    });

    // Increment status code counter
    metrics.incrementCounter('http_responses_total', 1, {
      method: req.method,
      path: req.route ? req.route.path : req.path,
      status: res.statusCode.toString()
    });
  });

  next();
}

/**
 * Track image generation metrics
 */
function trackImageGeneration(params, duration, success, error = null) {
  metrics.incrementCounter('image_generations_total', 1, {
    model: params.model || 'dall-e-3',
    success: success.toString()
  });

  if (success) {
    metrics.recordHistogram('image_generation_duration_ms', duration, {
      model: params.model || 'dall-e-3'
    });
  } else {
    metrics.incrementCounter('image_generation_errors_total', 1, {
      model: params.model || 'dall-e-3',
      error: error || 'unknown'
    });
  }
}

/**
 * Update system metrics (memory, etc.)
 */
function updateSystemMetrics() {
  const memUsage = process.memoryUsage();

  metrics.setGauge('nodejs_memory_heap_used_bytes', memUsage.heapUsed);
  metrics.setGauge('nodejs_memory_heap_total_bytes', memUsage.heapTotal);
  metrics.setGauge('nodejs_memory_external_bytes', memUsage.external);
  metrics.setGauge('nodejs_memory_rss_bytes', memUsage.rss);
}

// Update system metrics every 10 seconds
setInterval(updateSystemMetrics, 10000);
updateSystemMetrics(); // Initial update

module.exports = {
  metrics,
  metricsMiddleware,
  trackImageGeneration,
  updateSystemMetrics,
  MetricsStore
};
