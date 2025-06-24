import express from 'express';
import assignmentController from '../controllers/assignmentController.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Static routes FIRST (before dynamic routes)
router.get('/due-soon', authenticateToken, assignmentController.getAssignmentsDueSoon);
router.get('/overdue', authenticateToken, assignmentController.getOverdueAssignments);

// Get all assignments
router.get('/', authenticateToken, assignmentController.getAllAssignments);

// Get assignments for a lesson
router.get('/lesson/:lesson_id', assignmentController.getAssignmentsByLesson);

// Get assignments for a course
router.get('/course/:course_id', authenticateToken, assignmentController.getAssignmentsByCourse);

// Dynamic routes AFTER static routes
router.get('/:id', assignmentController.getAssignmentById);

// Protected routes (require authentication)
router.post('/', authenticateToken, assignmentController.createAssignment);
router.put('/:id', authenticateToken, assignmentController.updateAssignment);
router.delete('/:id', authenticateToken, assignmentController.deleteAssignment);

// Submission management
router.post('/:id/submit', authenticateToken, assignmentController.submitAssignment);
router.put('/submissions/:submission_id/grade', authenticateToken, assignmentController.gradeSubmission);
router.get('/:assignment_id/submissions', authenticateToken, assignmentController.getSubmissionsByAssignment);
router.get('/submissions/user/:user_id', authenticateToken, assignmentController.getSubmissionsByUser);
router.get('/course/:course_id/pending-submissions', authenticateToken, assignmentController.getPendingSubmissions);

// Assignment statistics
router.get('/:assignment_id/statistics', authenticateToken, assignmentController.getAssignmentStatistics);

// Publishing
router.put('/:id/publish', authenticateToken, assignmentController.publishAssignment);
router.put('/:id/unpublish', authenticateToken, assignmentController.unpublishAssignment);

export default router;