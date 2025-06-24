import express from 'express';
import reviewController from '../controllers/reviewController.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
// More specific routes first
router.get('/course/:course_id', reviewController.getCourseReviews);
// Commenting out this route as it requires course_id parameter

// Protected routes (require authentication)
// More specific routes first
router.get('/course/:course_id/can-review', authenticateToken, reviewController.canUserReviewCourse);
router.post('/course/:course_id', authenticateToken, reviewController.createReview);

// Commenting out this route as it requires user_id parameter

// Generic ID routes
router.get('/:id', reviewController.getReviewById);
router.put('/:id', authenticateToken, reviewController.updateReview); // Includes authorization check inside controller
router.delete('/:id', authenticateToken, reviewController.deleteReview); // Includes authorization check inside controller
router.post('/:id/helpful', authenticateToken, reviewController.markReviewAsHelpful);

export default router;