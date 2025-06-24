
import app from './app.js';
import dotenv from 'dotenv';
import { testConnection } from './config/db.js';
import { setupGlobalErrorHandlers } from './middleware/errorHandler.js';

dotenv.config();
// Remove this line: app.use(express.json());
// Setup global error handlers for uncaught exceptions and unhandled rejections
setupGlobalErrorHandlers();

const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV || 'development';

// Test database connection before starting the server
testConnection()
  .then(() => {
    const server = app.listen(PORT, () => {  // ✅ Now 'app' is defined
      console.log(`Server running in ${ENV} mode on port ${PORT}`);
    });

    // Handle server shutdown gracefully
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Process terminated!');
      });
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });