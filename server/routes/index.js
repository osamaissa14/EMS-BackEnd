import express from 'express';
import userRoutes from './userRoutes.js';
import courseRoutes from './courseRoutes.js';
import moduleRoutes from './moduleRoutes.js';
import lessonRoutes from './lessonRoutes.js';
import enrollmentRoutes from './enrollmentRoutes.js';
import quizRoutes from './quizRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import reviewRoutes from './reviewRoutes.js';
import authRoutes from './auth.js';
import instructorRoutes from './instructorRoutes.js';
import uploadRoutes from './UploadRoutes.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Base route
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to the LMS API' });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/courses', courseRoutes);
router.use('/modules', moduleRoutes);
router.use('/lessons', lessonRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/quizzes', quizRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/notifications', authenticateToken, notificationRoutes);
router.use('/reviews', reviewRoutes);
router.use('/instructor', instructorRoutes);
router.use('/files', uploadRoutes);

export default router;