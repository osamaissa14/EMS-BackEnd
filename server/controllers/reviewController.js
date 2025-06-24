import ReviewModel from '../models/reviewModel.js';
import CourseModel from '../models/courseModel.js';
import { createResponse } from '../utils/helper.js';

const reviewController = {
  // Create a new review
  async createReview(req, res) {
    try {
      const { course_id } = req.params;
      const { content } = req.body;
      const user_id = req.user.id;

      // Check if course exists
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Check if user can review this course
      const canReview = await ReviewModel.canUserReviewCourse(user_id, course_id);
      if (!canReview.can_review) {
        return res.status(403).json(createResponse(false, canReview.message, null));
      }

      // Create review
      const review = await ReviewModel.create({
        user_id,
        course_id,
        content
      });



      return res.status(201).json(createResponse(true, 'Review created successfully', review));
    } catch (error) {
      console.error('Error creating review:', error);
      return res.status(500).json(createResponse(false, 'Failed to create review', null));
    }
  },

  // Get reviews for a course
  async getCourseReviews(req, res) {
    try {
      const { course_id } = req.params;
      const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc' } = req.query;

      // Check if course exists
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Get reviews
      const reviews = await ReviewModel.findByCourse(course_id, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort_by,
        sort_order
      });



      return res.status(200).json(createResponse(true, 'Reviews retrieved successfully', {
        reviews: reviews.reviews,
        total: reviews.total,
        statistics
      }));
    } catch (error) {
      console.error('Error getting reviews:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve reviews', null));
    }
  },

  // Get a review by ID
  async getReviewById(req, res) {
    try {
      const { id } = req.params;

      // Get review
      const review = await ReviewModel.findById(id);
      
      if (!review) {
        return res.status(404).json(createResponse(false, 'Review not found', null));
      }

      return res.status(200).json(createResponse(true, 'Review retrieved successfully', review));
    } catch (error) {
      console.error('Error getting review:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve review', null));
    }
  },

  // Update a review
  async updateReview(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const user_id = req.user.id;

      // Get the current review
      const review = await ReviewModel.findById(id);
      
      if (!review) {
        return res.status(404).json(createResponse(false, 'Review not found', null));
      }

      // Check if review belongs to the user
      if (review.user_id !== user_id) {
        return res.status(403).json(createResponse(false, 'Not authorized to update this review', null));
      }

      // Update the review
      const updatedReview = await ReviewModel.update(id, updates);



      return res.status(200).json(createResponse(true, 'Review updated successfully', updatedReview));
    } catch (error) {
      console.error('Error updating review:', error);
      return res.status(500).json(createResponse(false, 'Failed to update review', null));
    }
  },

  // Delete a review
  async deleteReview(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;
      const isAdmin = req.user && req.user.role === 'admin';

      // Get the current review
      const review = await ReviewModel.findById(id);
      
      if (!review) {
        return res.status(404).json(createResponse(false, 'Review not found', null));
      }

      // Check if review belongs to the user or user is admin
      if (review.user_id !== user_id && !isAdmin) {
        return res.status(403).json(createResponse(false, 'Not authorized to delete this review', null));
      }

      // Delete the review
      await ReviewModel.delete(id);



      return res.status(200).json(createResponse(true, 'Review deleted successfully', null));
    } catch (error) {
      console.error('Error deleting review:', error);
      return res.status(500).json(createResponse(false, 'Failed to delete review', null));
    }
  },

  // Mark a review as helpful
  async markReviewAsHelpful(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;

      // Get the review
      const review = await ReviewModel.findById(id);
      
      if (!review) {
        return res.status(404).json(createResponse(false, 'Review not found', null));
      }

      // Check if user has already marked this review as helpful
      const hasMarked = await ReviewModel.hasUserMarkedReviewAsHelpful(user_id, id);
      if (hasMarked) {
        return res.status(400).json(createResponse(false, 'You have already marked this review as helpful', null));
      }

      // Mark as helpful
      await ReviewModel.markAsHelpful(id, user_id);

      return res.status(200).json(createResponse(true, 'Review marked as helpful', null));
    } catch (error) {
      console.error('Error marking review as helpful:', error);
      return res.status(500).json(createResponse(false, 'Failed to mark review as helpful', null));
    }
  },

  // Get reviews by user
  async getUserReviews(req, res) {
    try {
      const { user_id } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const requestingUserId = req.user.id;
      const isAdmin = req.user && req.user.role === 'admin';
      
      // Only allow users to view their own reviews unless they're an admin
      // Convert both to strings for comparison to handle type mismatches
      if (String(user_id) !== String(requestingUserId) && !isAdmin) {
        return res.status(403).json(createResponse(false, 'Not authorized to view these reviews', null));
      }

      // Get reviews
      const reviews = await ReviewModel.findByUser(user_id, parseInt(page), parseInt(limit));

      return res.status(200).json(createResponse(true, 'Reviews retrieved successfully', reviews));
    } catch (error) {
      console.error('Error getting reviews:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve reviews', null));
    }
  },

  // Get featured reviews for a course
  async getFeaturedReviews(req, res) {
    try {
      const { course_id } = req.params;
      const { limit = 3 } = req.query;

      // Check if course exists
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Get featured reviews
      const reviews = await ReviewModel.getFeaturedReviews(course_id, parseInt(limit));

      return res.status(200).json(createResponse(true, 'Featured reviews retrieved successfully', reviews));
    } catch (error) {
      console.error('Error getting featured reviews:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve featured reviews', null));
    }
  },

  // Check if a user can review a course
  async canUserReviewCourse(req, res) {
    try {
      const { course_id } = req.params;
      const user_id = req.user.id;

      // Check if course exists
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Check if user can review
      const result = await ReviewModel.canUserReviewCourse(user_id, course_id);

      return res.status(200).json(createResponse(true, 'Review eligibility checked successfully', result));
    } catch (error) {
      console.error('Error checking review eligibility:', error);
      return res.status(500).json(createResponse(false, 'Failed to check review eligibility', null));
    }
  }
};

export default reviewController;