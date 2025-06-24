import express from 'express';
import quizController from '../controllers/quizController.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get quizzes for a lesson
router.get('/lesson/:lesson_id', quizController.getQuizzesByLesson);

// Get quizzes for a course
router.get('/course/:course_id', quizController.getQuizzesByCourse);

// Get a single quiz with questions
router.get('/:id', quizController.getQuizById);

// Protected routes (require authentication)
router.post('/', authenticateToken, quizController.createQuiz); // Includes authorization check inside controller
router.put('/:id', authenticateToken, quizController.updateQuiz); // Includes authorization check inside controller
router.delete('/:id', authenticateToken, quizController.deleteQuiz); // Includes authorization check inside controller

// Question management
router.post('/:quiz_id/questions', authenticateToken, quizController.addQuestion); // Includes authorization check inside controller
router.put('/questions/:question_id', authenticateToken, quizController.updateQuestion); // Includes authorization check inside controller
router.delete('/questions/:question_id', authenticateToken, quizController.deleteQuestion); // Includes authorization check inside controller

// Quiz attempts
router.post('/:quiz_id/attempts', authenticateToken, quizController.submitQuizAttempt);
router.get('/attempts/user/:user_id', authenticateToken, quizController.getQuizAttemptsByUser); // Includes authorization check inside controller
router.get('/:quiz_id/attempts', authenticateToken, quizController.getQuizAttemptsByQuiz); // Includes authorization check inside controller

// Quiz statistics
router.get('/:quiz_id/statistics', authenticateToken, quizController.getQuizStatistics); // Includes authorization check inside controller

// Publishing
router.put('/:id/publish', authenticateToken, quizController.publishQuiz); // Includes authorization check inside controller
router.put('/:id/unpublish', authenticateToken, quizController.unpublishQuiz); // Includes authorization check inside controller

export default router;