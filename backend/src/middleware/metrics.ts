import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

// Basic metrics counters stored in memory
const metricsData = {
  totalRequests: 0,
  errorCount: 0,
  routes: {} as Record<string, number>,
};

export function requestMetrics(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  metricsData.totalRequests++;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const pathKey = `${req.method} ${req.baseUrl || req.path}`;
    metricsData.routes[pathKey] = (metricsData.routes[pathKey] || 0) + 1;

    if (res.statusCode >= 400) {
      metricsData.errorCount++;
    }

    logger.info(`HTTP ${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
    });
  });

  next();
}

export function getMetricsSummary() {
  return {
    ...metricsData,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}
