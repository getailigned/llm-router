// Test setup file for Jest
import { jest } from '@jest/globals';

// Mock environment variables
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3001';
process.env['LOG_LEVEL'] = 'error';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock process.memoryUsage for consistent testing
Object.defineProperty(process, 'memoryUsage', {
  value: jest.fn(() => ({
    rss: 1024 * 1024,
    heapTotal: 512 * 1024,
    heapUsed: 256 * 1024,
    external: 128 * 1024,
  })),
});

// Mock process.uptime for consistent testing
Object.defineProperty(process, 'uptime', {
  value: jest.fn(() => 123.45),
});

// Mock process.pid for consistent testing
Object.defineProperty(process, 'pid', {
  value: 12345,
});

// Mock process.platform and process.arch for consistent testing
Object.defineProperty(process, 'platform', {
  value: 'linux',
});

Object.defineProperty(process, 'arch', {
  value: 'x64',
});

Object.defineProperty(process, 'version', {
  value: 'v18.20.8',
});

// Global test timeout
jest.setTimeout(10000);
