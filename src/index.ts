// =============================================================================
// LLM Router Service - Main Application Entry Point
// =============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

// Import services and middleware
import { logger } from './services/loggerService';
import { configService } from './services/configService';
import { authMiddleware } from './middleware/authMiddleware';
import { rateLimitMiddleware } from './middleware/rateLimitMiddleware';
import { requestLoggerMiddleware } from './middleware/requestLoggerMiddleware';
import { errorHandlerMiddleware } from './middleware/errorHandlerMiddleware';

// Import controllers
import { healthController } from './controllers/healthController';
import routingController from './controllers/routingController';
import { analyticsController } from './controllers/analyticsController';
import { configController } from './controllers/configController';
import { adminController } from './controllers/adminController';

// Import services
import { vertexAIService } from './services/vertexAIService';
import { routingService } from './services/routingService';
import { analyticsService } from './services/analyticsService';
import { cacheService } from './services/cacheService';
import { databaseService } from './services/databaseService';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Create Express app
const app = express();
const server = createServer(app);

// Create Socket.IO server for real-time updates
const io = new Server(server, {
  cors: {
    origin: process.env['CORS_ORIGIN'] || '*',
    methods: ['GET', 'POST']
  }
});

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

// Security middleware
if (process.env['ENABLE_HELMET'] === 'true') {
  app.use(helmet());
}

// CORS configuration
if (process.env['ENABLE_CORS'] === 'true') {
  app.use(cors({
    origin: process.env['CORS_ORIGIN'] || '*',
    credentials: true
  }));
}

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: process.env['MAX_REQUEST_SIZE'] || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env['MAX_REQUEST_SIZE'] || '10mb' }));

// Logging middleware
if (process.env['ENABLE_REQUEST_LOGGING'] === 'true') {
  app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
}

// Request logging middleware
app.use(requestLoggerMiddleware);

// Rate limiting middleware
if (process.env['ENABLE_RATE_LIMITING'] === 'true') {
  app.use(rateLimitMiddleware);
}

// =============================================================================
// ROUTES CONFIGURATION
// =============================================================================

// Health check routes (no authentication required)
app.use('/api/v1/health', healthController);

// Core routing routes (require authentication)
app.use('/api/v1/route', authMiddleware, routingController);

// Analytics routes (require authentication)
app.use('/api/v1/analytics', authMiddleware, analyticsController);

// Configuration management routes (require authentication)
app.use('/api/v1/config', authMiddleware, configController);

// Admin dashboard routes (require authentication)
app.use('/api/v1/admin', authMiddleware, adminController);

// =============================================================================
// SOCKET.IO EVENTS
// =============================================================================

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Join admin room for real-time updates
  socket.on('join-admin', (data) => {
    if (data.role === 'admin') {
      socket.join('admin-room');
      logger.info(`Admin joined: ${socket.id}`);
    }
  });

  // Handle real-time monitoring
  socket.on('subscribe-metrics', () => {
    socket.join('metrics-room');
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// Global error handler (must be last)
app.use(errorHandlerMiddleware);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// SERVICE INITIALIZATION
// =============================================================================

async function initializeServices() {
  try {
    logger.info('Initializing LLM Router services...');

    // Initialize configuration service
    await configService.initialize();
    logger.info('Configuration service initialized');

    // Initialize cache service
    await cacheService.initialize();
    logger.info('Cache service initialized');

    // Initialize database service
    await databaseService.initialize();
    logger.info('Database service initialized');

    // Initialize Vertex AI service
    await vertexAIService.initialize();
    logger.info('Vertex AI service initialized');

    // Initialize routing service
    await routingService.initialize();
    logger.info('Routing service initialized');

    // Initialize analytics service
    await analyticsService.initialize();
    logger.info('Analytics service initialized');

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close Socket.IO server
    io.close(() => {
      logger.info('Socket.IO server closed');
    });

    // Close database connections
    await databaseService.close();
    logger.info('Database connections closed');

    // Close cache connections
    await cacheService.close();
    logger.info('Cache connections closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// =============================================================================
// APPLICATION STARTUP
// =============================================================================

async function startServer() {
  try {
    // Initialize services
    await initializeServices();

    // Get port from environment
    const port = process.env['PORT'] || 3000;

    // Start server
    server.listen(port, () => {
      logger.info(`LLM Router Service started on port ${port}`);
      logger.info(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
      logger.info(`Health check: http://localhost:${port}/api/v1/health`);
      logger.info(`Admin dashboard: http://localhost:${port}/api/v1/admin/dashboard`);
    });

    // Start metrics server if enabled
    if (process.env['ENABLE_METRICS'] === 'true') {
      const metricsPort = process.env['METRICS_PORT'] || 9090;
      logger.info(`Metrics server will start on port ${metricsPort}`);
    }

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Export for testing
export { app, server, io };
