# LMS Capstone Project - Setup Guide

This guide will help you set up and run the complete LMS (Learning Management System) with both client and server components.

## Project Structure

```
lms-capstone-project/
├── client/                 # React frontend application
├── server/                 # Express.js backend API
├── package.json           # Root package.json for running both
├── .env                   # Environment variables
└── SETUP.md              # This setup guide
```

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **PostgreSQL** (v12 or higher)
- **Git**

## Database Setup

1. **Install PostgreSQL** if not already installed
2. **Create a database** for the LMS:
   ```sql
   CREATE DATABASE lms_db;
   CREATE USER lms_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE lms_db TO lms_user;
   ```

3. **Update the .env file** with your database credentials:
   ```env
   DATABASE_URL=postgres://lms_user:your_password@localhost:5432/lms_db
   ```

## Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd lms-capstone-project

# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..

# Install client dependencies
cd client
npm install
cd ..
```

### 2. Environment Configuration

#### Root .env file (already configured)
The main `.env` file contains server configuration:
- Database connection
- JWT secrets
- Google OAuth credentials
- Email configuration
- CORS settings

#### Client .env file
The client has its own `.env` file for frontend configuration:
- API endpoints
- Feature flags
- File upload settings

### 3. Database Schema Setup

```bash
# Navigate to server directory
cd server

# Run database schema setup
node db/schema.sql

# Or if you have migration scripts:
node db/check_schema.js
```

## Running the Application

### Option 1: Run Both Client and Server Together (Recommended)

```bash
# From the root directory
npm run dev
```

This command will:
- Start the Express server on `http://localhost:5000`
- Start the React client on `http://localhost:3000`
- Enable hot reloading for both

### Option 2: Run Client and Server Separately

#### Terminal 1 - Server
```bash
cd server
npm run dev
# Server runs on http://localhost:5000
```

#### Terminal 2 - Client
```bash
cd client
npm run dev
# Client runs on http://localhost:3000
```

## API Connection Configuration

The client is configured to connect to the server through:

### 1. Vite Proxy (Development)
- **File**: `client/vite.config.js`
- **Proxy**: `/api` requests → `http://localhost:5000`
- **Benefits**: Avoids CORS issues in development

### 2. Axios Configuration
- **File**: `client/src/lib/api.js`
- **Base URL**: Configurable via `VITE_API_URL`
- **Features**: 
  - Automatic token management
  - Request/response interceptors
  - Error handling

### 3. React Query Integration
- **File**: `client/src/hooks/useApi.js`
- **Features**:
  - Server state management
  - Caching and synchronization
  - Optimistic updates
  - Error handling with toast notifications

## Available Scripts

### Root Level
```bash
npm run dev          # Run both client and server
npm run start        # Production start
npm run build        # Build client for production
npm run server:dev   # Run only server in development
npm run client       # Run only client
```

### Server
```bash
npm start           # Start server in production
npm run dev         # Start server with nodemon
```

### Client
```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
npm run test        # Run tests
```

## API Endpoints

The server provides the following API endpoints:

- **Authentication**: `/api/auth/*`
- **Users**: `/api/users/*`
- **Courses**: `/api/courses/*`
- **Modules**: `/api/modules/*`
- **Lessons**: `/api/lessons/*`
- **Enrollments**: `/api/enrollments/*`
- **Quizzes**: `/api/quizzes/*`
- **Assignments**: `/api/assignments/*`
- **Notifications**: `/api/notifications/*`
- **Reviews**: `/api/reviews/*`

## Features

### Client Features
- ✅ Modern React 18 with hooks
- ✅ TypeScript support
- ✅ Tailwind CSS + shadcn/ui components
- ✅ React Query for server state
- ✅ React Router for navigation
- ✅ Form validation with Zod
- ✅ Dark/light mode support
- ✅ Responsive design
- ✅ 3D graphics with Three.js
- ✅ Data visualization with Recharts

### Server Features
- ✅ Express.js with modern ES modules
- ✅ PostgreSQL with connection pooling
- ✅ JWT authentication
- ✅ Google OAuth integration
- ✅ Rate limiting and security
- ✅ Email notifications
- ✅ File upload support
- ✅ Comprehensive error handling
- ✅ Request logging

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check PostgreSQL is running
   - Verify DATABASE_URL in .env
   - Ensure database exists

2. **CORS Errors**
   - Check CORS_ORIGIN in .env matches client URL
   - Ensure proxy is configured in vite.config.js

3. **Port Already in Use**
   ```bash
   # Kill process on port 5000
   npx kill-port 5000
   
   # Kill process on port 3000
   npx kill-port 3000
   ```

4. **Module Not Found Errors**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

### Development Tips

1. **Hot Reloading**: Both client and server support hot reloading
2. **API Testing**: Use the browser dev tools or Postman to test API endpoints
3. **Database Inspection**: Use pgAdmin or similar tools to inspect the database
4. **Logs**: Check console output for both client and server for debugging

## Production Deployment

### Build for Production
```bash
# Build client
npm run build

# The built files will be in client/dist/
```

### Environment Variables for Production
Update the following in your production environment:
- `NODE_ENV=production`
- `DATABASE_URL` (production database)
- `JWT_SECRET` (strong secret)
- `CORS_ORIGIN` (production client URL)

## Support

If you encounter any issues:
1. Check this setup guide
2. Review the console logs
3. Check the GitHub issues
4. Contact the development team

---

**Happy coding! 🚀**