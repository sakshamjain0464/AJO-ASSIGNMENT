import { createApp } from './app';
import { config } from './config/env';
import { getRedisClient, closeRedisClient } from './config/redis';
import { seedAuctionItems } from './seed/seed';

/**
 * Bootstrap and start the server
 */
async function startServer(): Promise<void> {
  try {
    console.log('Starting Live Bidding Platform...');

    // Connect to Redis
    console.log('Connecting to Redis...');
    await getRedisClient();
    console.log('Redis connected successfully');

    // Seed auction items
    console.log('Seeding auction items...');
    await seedAuctionItems();

    // Create Express app and Socket.io server
    const { httpServer } = createApp();

    // Start listening
    httpServer.listen(config.port, () => {
      console.log('='.repeat(50));
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`📡 WebSocket ready for connections`);
      console.log(`🗄️  Redis connected to ${config.redisHost}:${config.redisPort}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log('='.repeat(50));
    });

    // Graceful shutdown handlers
    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      try {
        httpServer.close(() => {
          console.log('HTTP server closed');
        });

        await closeRedisClient();
        console.log('Redis connection closed');

        console.log('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server
startServer();

