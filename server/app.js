import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import passport from "./config/passport.js";
import session from "express-session";
import rateLimit from "express-rate-limit";
import routes from "./routes/index.js";
import { errorHandler, notFound, handleRateLimitError } from "./middleware/errorHandler.js";
import dotenv from 'dotenv';
dotenv.config();

const app = express();

// ======================
// Logging Helper
// ======================
const logHttpRequest = (req, res, duration) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${duration}ms`,
    userAgent: req.get('User-Agent') || 'Unknown',
    ip: req.ip || req.connection.remoteAddress
  };

  // Skip logging for static assets
  if (!req.originalUrl.match(/\.(png|jpg|jpeg|gif|css|js|ico|svg|woff|woff2|ttf|eot)$/)) {
    // Request logging removed for production
  }
};

// ======================
// Security Middleware
// ======================
app.set('etag', process.env.NODE_ENV === 'production' ? 'strong' : false);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : [])],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", process.env.API_BASE_URL || ""]
    }
  },
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  xssFilter: true,
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 63072000 } : false
}));

// ======================
// Request Handling
// ======================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  headers: true,
  handler: handleRateLimitError
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// Session & Authentication
// ======================
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  },
  name: 'sessionId',
  proxy: process.env.NODE_ENV === 'production'
}));

app.use(passport.initialize());
app.use(passport.session());

// ======================
// Logging
// ======================
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    logHttpRequest(req, res, responseTime);
  });
  next();
};


const handleOAuthError = (error) => {
  console.error('OAuth failed:', error);
  // Show user-friendly error, don't auto-retry
  setAuthError('Login failed. Please try again.');
  // Don't automatically redirect back to OAuth
};


if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(requestLogger);
}

// ======================
// Health Check
// ======================
app.get("/api/health", (_, res) => res.status(200).json({ status: "ok", timestamp: new Date().toISOString() }));

// ======================
// Routes
// ======================
app.use("/api", routes);

// ======================
// Error Handling
// ======================
app.use(notFound);
app.use(errorHandler);

export default app;
