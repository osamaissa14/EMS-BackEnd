import express from 'express';
import lessonController from '../controllers/lessonController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get lessons for a module (public for published courses, protected for unpublished)
router.get('/module/:module_id', lessonController.getLessonsByModule);

// Get lessons for a course (public for published courses, protected for unpublished)
router.get('/course/:course_id', lessonController.getLessonsByCourse);

// Get a single lesson
router.get('/:id', lessonController.getLessonById);

// Protected routes (require authentication)
router.post('/', authenticateToken, lessonController.createLesson); // Includes authorization check inside controller
router.put('/:id', authenticateToken, lessonController.updateLesson); // Includes authorization check inside controller
router.delete('/:id', authenticateToken, lessonController.deleteLesson); // Includes authorization check inside controller
router.put('/module/:module_id/reorder', authenticateToken, lessonController.reorderLessons); // Includes authorization check inside controller

// Student progress routes
router.post('/:id/complete', authenticateToken, lessonController.markLessonCompleted);
router.get('/course/:course_id/progress', authenticateToken, lessonController.getCourseProgress);

export default router;