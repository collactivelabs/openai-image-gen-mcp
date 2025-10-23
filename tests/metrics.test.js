const {
  MetricsStore,
  metricsMiddleware,
  trackImageGeneration,
  updateSystemMetrics
} = require('../src/utils/metrics');

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Metrics Utilities', () => {
  describe('MetricsStore', () => {
    let store;

    beforeEach(() => {
      store = new MetricsStore();
    });

    describe('incrementCounter', () => {
      it('should increment counter by 1', () => {
        store.incrementCounter('test_counter');

        const metrics = store.getMetrics();
        expect(metrics.counters[0].value).toBe(1);
      });

      it('should increment counter by custom value', () => {
        store.incrementCounter('test_counter', 5);

        const metrics = store.getMetrics();
        expect(metrics.counters[0].value).toBe(5);
      });

      it('should accumulate counter values', () => {
        store.incrementCounter('test_counter', 2);
        store.incrementCounter('test_counter', 3);

        const metrics = store.getMetrics();
        expect(metrics.counters[0].value).toBe(5);
      });

      it('should handle labels', () => {
        store.incrementCounter('http_requests', 1, { method: 'POST', path: '/api' });
        store.incrementCounter('http_requests', 1, { method: 'GET', path: '/api' });

        const metrics = store.getMetrics();
        expect(metrics.counters).toHaveLength(2);
      });
    });

    describe('setGauge', () => {
      it('should set gauge value', () => {
        store.setGauge('memory_usage', 1024);

        const metrics = store.getMetrics();
        expect(metrics.gauges[0].value).toBe(1024);
      });

      it('should overwrite gauge value', () => {
        store.setGauge('memory_usage', 1024);
        store.setGauge('memory_usage', 2048);

        const metrics = store.getMetrics();
        expect(metrics.gauges).toHaveLength(1);
        expect(metrics.gauges[0].value).toBe(2048);
      });

      it('should handle labels', () => {
        store.setGauge('temperature', 20, { location: 'server1' });
        store.setGauge('temperature', 25, { location: 'server2' });

        const metrics = store.getMetrics();
        expect(metrics.gauges).toHaveLength(2);
      });
    });

    describe('recordHistogram', () => {
      it('should record histogram values', () => {
        store.recordHistogram('response_time', 100);
        store.recordHistogram('response_time', 200);
        store.recordHistogram('response_time', 300);

        const metrics = store.getMetrics();
        const hist = metrics.histograms[0];

        expect(hist.count).toBe(3);
        expect(hist.sum).toBe(600);
        expect(hist.min).toBe(100);
        expect(hist.max).toBe(300);
        expect(hist.avg).toBe(200);
      });

      it('should calculate percentiles', () => {
        // Record values from 1 to 100
        for (let i = 1; i <= 100; i++) {
          store.recordHistogram('test', i);
        }

        const metrics = store.getMetrics();
        const hist = metrics.histograms[0];

        expect(hist.p50).toBeGreaterThanOrEqual(45);
        expect(hist.p50).toBeLessThanOrEqual(55);
        expect(hist.p95).toBeGreaterThanOrEqual(90);
        expect(hist.p99).toBeGreaterThanOrEqual(95);
      });

      it('should limit stored values to 1000', () => {
        // Record 1500 values
        for (let i = 0; i < 1500; i++) {
          store.recordHistogram('test', i);
        }

        const hist = store.histograms.get('test');
        expect(hist.values.length).toBe(1000);
        expect(hist.count).toBe(1500); // Count should still be accurate
      });

      it('should handle labels', () => {
        store.recordHistogram('latency', 100, { endpoint: '/api' });
        store.recordHistogram('latency', 200, { endpoint: '/api' });

        const metrics = store.getMetrics();
        expect(metrics.histograms).toHaveLength(1);
        expect(metrics.histograms[0].count).toBe(2);
      });
    });

    describe('getMetrics', () => {
      it('should return all metrics', () => {
        store.incrementCounter('counter1', 5);
        store.setGauge('gauge1', 100);
        store.recordHistogram('hist1', 50);

        const metrics = store.getMetrics();

        expect(metrics.timestamp).toBeDefined();
        expect(metrics.uptime).toBeGreaterThanOrEqual(0);
        expect(metrics.counters).toHaveLength(1);
        expect(metrics.gauges).toHaveLength(1);
        expect(metrics.histograms).toHaveLength(1);
      });

      it('should include uptime', () => {
        const metrics = store.getMetrics();

        expect(metrics.uptime).toBeGreaterThanOrEqual(0);
        expect(typeof metrics.uptime).toBe('number');
      });
    });

    describe('getPrometheusMetrics', () => {
      it('should format metrics in Prometheus text format', () => {
        store.incrementCounter('http_requests_total', 42);
        store.setGauge('memory_bytes', 1024);

        const text = store.getPrometheusMetrics();

        expect(text).toContain('# HELP process_uptime_seconds');
        expect(text).toContain('# TYPE process_uptime_seconds gauge');
        expect(text).toContain('# HELP http_requests_total');
        expect(text).toContain('# TYPE http_requests_total counter');
        expect(text).toContain('http_requests_total 42');
        expect(text).toContain('memory_bytes 1024');
      });

      it('should format labels correctly', () => {
        store.incrementCounter('http_requests', 1, { method: 'POST', path: '/api' });

        const text = store.getPrometheusMetrics();

        expect(text).toContain('http_requests{method="POST",path="/api"} 1');
      });

      it('should include histogram metadata', () => {
        store.recordHistogram('request_duration', 100);
        store.recordHistogram('request_duration', 200);

        const text = store.getPrometheusMetrics();

        expect(text).toContain('# HELP request_duration');
        expect(text).toContain('# TYPE request_duration histogram');
        expect(text).toContain('request_duration_count 2');
        expect(text).toContain('request_duration_sum 300');
      });
    });

    describe('reset', () => {
      it('should clear all metrics', () => {
        store.incrementCounter('counter1', 5);
        store.setGauge('gauge1', 100);
        store.recordHistogram('hist1', 50);

        store.reset();

        const metrics = store.getMetrics();
        expect(metrics.counters).toHaveLength(0);
        expect(metrics.gauges).toHaveLength(0);
        expect(metrics.histograms).toHaveLength(0);
      });
    });

    describe('percentile', () => {
      it('should return 0 for empty array', () => {
        const result = store.percentile([], 0.5);
        expect(result).toBe(0);
      });

      it('should calculate correct percentile for single value', () => {
        const result = store.percentile([100], 0.5);
        expect(result).toBe(100);
      });

      it('should calculate percentiles correctly', () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        expect(store.percentile(values, 0.5)).toBeGreaterThanOrEqual(4);
        expect(store.percentile(values, 0.5)).toBeLessThanOrEqual(6);
        expect(store.percentile(values, 0.9)).toBeGreaterThanOrEqual(8);
        expect(store.percentile(values, 1.0)).toBe(10);
      });
    });
  });

  describe('metricsMiddleware', () => {
    it('should track request metrics', (done) => {
      const req = {
        method: 'GET',
        path: '/api/test',
        route: { path: '/api/test' }
      };

      const res = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 0);
          }
        })
      };

      const next = jest.fn();

      metricsMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();

      setTimeout(() => {
        done();
      }, 10);
    });

    it('should call next middleware', () => {
      const req = { method: 'GET', path: '/test', route: { path: '/test' } };
      const res = { on: jest.fn(), statusCode: 200 };
      const next = jest.fn();

      metricsMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('trackImageGeneration', () => {
    let store;

    beforeEach(() => {
      // Get access to the metrics store
      const { metrics } = require('../src/utils/metrics');
      store = metrics;
      store.reset();
    });

    it('should track successful image generation', () => {
      const params = { model: 'dall-e-3', prompt: 'test' };
      trackImageGeneration(params, 1000, true);

      const metrics = store.getMetrics();
      const counter = metrics.counters.find(c =>
        c.name === 'image_generations_total' && c.labels.success === 'true'
      );

      expect(counter).toBeDefined();
      expect(counter.value).toBeGreaterThanOrEqual(1);
    });

    it('should track failed image generation', () => {
      const params = { model: 'dall-e-3', prompt: 'test' };
      trackImageGeneration(params, 1000, false, 'API Error');

      const metrics = store.getMetrics();
      const counter = metrics.counters.find(c =>
        c.name === 'image_generation_errors_total'
      );

      expect(counter).toBeDefined();
    });

    it('should record duration histogram for successful generations', () => {
      const params = { model: 'dall-e-3', prompt: 'test' };
      trackImageGeneration(params, 1500, true);

      const metrics = store.getMetrics();
      const hist = metrics.histograms.find(h =>
        h.name === 'image_generation_duration_ms'
      );

      expect(hist).toBeDefined();
      expect(hist.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('updateSystemMetrics', () => {
    it('should update memory metrics', () => {
      const { metrics } = require('../src/utils/metrics');
      const originalGauges = metrics.gauges.size;

      updateSystemMetrics();

      const metricsData = metrics.getMetrics();
      const memoryGauges = metricsData.gauges.filter(g =>
        g.name.startsWith('nodejs_memory_')
      );

      expect(memoryGauges.length).toBeGreaterThan(0);
    });

    it('should set heap used gauge', () => {
      const { metrics } = require('../src/utils/metrics');

      updateSystemMetrics();

      const metricsData = metrics.getMetrics();
      const heapUsed = metricsData.gauges.find(g =>
        g.name === 'nodejs_memory_heap_used_bytes'
      );

      expect(heapUsed).toBeDefined();
      expect(heapUsed.value).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    it('should provide complete metrics flow', () => {
      const { metrics } = require('../src/utils/metrics');
      metrics.reset();

      // Simulate some operations
      metrics.incrementCounter('operations', 1);
      metrics.setGauge('active_connections', 5);
      metrics.recordHistogram('operation_duration', 100);
      metrics.recordHistogram('operation_duration', 200);

      // Get metrics
      const data = metrics.getMetrics();

      expect(data.counters.length).toBeGreaterThan(0);
      expect(data.gauges.length).toBeGreaterThan(0);
      expect(data.histograms.length).toBeGreaterThan(0);

      // Get Prometheus format
      const prometheus = metrics.getPrometheusMetrics();
      expect(prometheus).toContain('operations 1');
      expect(prometheus).toContain('active_connections 5');
    });
  });
});
