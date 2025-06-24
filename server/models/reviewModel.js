import { query } from "../config/db.js";

const ReviewModel = {
  // Create a new review
  async create({ user_id, course_id, review_text = null }) {
    try {
      // Check if user is enrolled in the course
      const { rows: enrollmentRows } = await query(
        `SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2`,
        [user_id, course_id]
      );

      if (enrollmentRows.length === 0) {
        throw new Error('User must be enrolled in the course to leave a review');
      }

      // Check if user already reviewed this course
      const existingReview = await this.findByUserAndCourse(user_id, course_id);
      if (existingReview) {
        throw new Error('User has already reviewed this course');
      }

      const { rows } = await query(
        `INSERT INTO reviews (user_id, course_id, review_text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, course_id, review_text]
      );

      

      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Get review by ID
  async findById(id) {
    try {
      const { rows } = await query(
        `SELECT r.*, u.name as user_name, u.profile_picture, c.title as course_title
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         JOIN courses c ON r.course_id = c.id
         WHERE r.id = $1`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Find review by user and course
  async findByUserAndCourse(userId, courseId) {
    try {
      const { rows } = await query(
        `SELECT * FROM reviews WHERE user_id = $1 AND course_id = $2`,
        [userId, courseId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Get reviews for a course
  async findByCourse(courseId, { limit = 10, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = {}) {
    try {
      // Validate sort parameters to prevent SQL injection
      const validSortColumns = ['created_at', 'helpful_count'];
      const validSortOrders = ['ASC', 'DESC'];
      
      if (!validSortColumns.includes(sortBy)) sortBy = 'created_at';
      if (!validSortOrders.includes(sortOrder.toUpperCase())) sortOrder = 'DESC';
      
      const { rows } = await query(
        `SELECT r.*, u.name as user_name, u.profile_picture
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         WHERE r.course_id = $1
         ORDER BY r.${sortBy} ${sortOrder}
         LIMIT $2 OFFSET $3`,
        [courseId, limit, offset]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get reviews by a user
  async findByUser(userId, { limit = 10, offset = 0 } = {}) {
    try {
      const { rows } = await query(
        `SELECT r.*, c.title as course_title
         FROM reviews r
         JOIN courses c ON r.course_id = c.id
         WHERE r.user_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Update a review
  async update(id, { review_text }) {
    try {
      // Get the current review to find its course_id
      const { rows: currentReviewRows } = await query(
        `SELECT course_id FROM reviews WHERE id = $1`,
        [id]
      );

      if (currentReviewRows.length === 0) {
        throw new Error('Review not found');
      }

      const courseId = currentReviewRows[0].course_id;

      const { rows } = await query(
        `UPDATE reviews 
         SET review_text = COALESCE($2, review_text),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, review_text]
      );

      

      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete a review
  async delete(id) {
    try {
      // Get the current review to find its course_id
      const { rows: currentReviewRows } = await query(
        `SELECT course_id FROM reviews WHERE id = $1`,
        [id]
      );

      if (currentReviewRows.length === 0) {
        return null;
      }

      const courseId = currentReviewRows[0].course_id;

      const { rows } = await query(
        `DELETE FROM reviews WHERE id = $1 RETURNING *`,
        [id]
      );

      

      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Mark a review as helpful
  async markAsHelpful(reviewId, userId) {
    try {
      // Check if user already marked this review as helpful
      const { rows: existingRows } = await query(
        `SELECT id FROM review_helpful WHERE review_id = $1 AND user_id = $2`,
        [reviewId, userId]
      );

      if (existingRows.length > 0) {
        // User already marked this review as helpful, so remove it
        await query(
          `DELETE FROM review_helpful WHERE review_id = $1 AND user_id = $2`,
          [reviewId, userId]
        );

        // Decrement helpful count
        const { rows } = await query(
          `UPDATE reviews 
           SET helpful_count = helpful_count - 1 
           WHERE id = $1 
           RETURNING *`,
          [reviewId]
        );

        return { review: rows[0], marked: false };
      } else {
        // User hasn't marked this review as helpful yet, so add it
        await query(
          `INSERT INTO review_helpful (review_id, user_id) VALUES ($1, $2)`,
          [reviewId, userId]
        );

        // Increment helpful count
        const { rows } = await query(
          `UPDATE reviews 
           SET helpful_count = helpful_count + 1 
           WHERE id = $1 
           RETURNING *`,
          [reviewId]
        );

        return { review: rows[0], marked: true };
      }
    } catch (error) {
      throw error;
    }
  },

  // Check if a user has marked a review as helpful
  async isMarkedHelpful(reviewId, userId) {
    try {
      const { rows } = await query(
        `SELECT EXISTS(
           SELECT 1 FROM review_helpful 
           WHERE review_id = $1 AND user_id = $2
         ) as is_marked`,
        [reviewId, userId]
      );
      return rows[0].is_marked;
    } catch (error) {
      throw error;
    }
  },



  // Get featured reviews for a course (highest rated or most helpful)
  async getFeaturedReviews(courseId, limit = 3) {
    try {
      const { rows } = await query(
        `SELECT r.*, u.name as user_name, u.profile_picture
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         WHERE r.course_id = $1 AND r.review_text IS NOT NULL AND LENGTH(r.review_text) > 10
         ORDER BY r.helpful_count DESC, r.created_at DESC
         LIMIT $2`,
        [courseId, limit]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Check if a user can review a course (must be enrolled and not already reviewed)
  async canUserReviewCourse(userId, courseId) {
    try {
      // Check if user is enrolled
      const { rows: enrollmentRows } = await query(
        `SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2`,
        [userId, courseId]
      );

      if (enrollmentRows.length === 0) {
        return { canReview: false, reason: 'not_enrolled' };
      }

      // Check if user already reviewed this course
      const { rows: reviewRows } = await query(
        `SELECT id FROM reviews WHERE user_id = $1 AND course_id = $2`,
        [userId, courseId]
      );

      if (reviewRows.length > 0) {
        return { canReview: false, reason: 'already_reviewed', reviewId: reviewRows[0].id };
      }

      return { canReview: true };
    } catch (error) {
      throw error;
    }
  }
};

export default ReviewModel;