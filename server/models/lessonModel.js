


import { query } from "../config/db.js";
const LessonModel = {
  // Create a new lesson
  async create({ title, content, content_type, module_id, order_index, duration, video_url, is_free }) {
    try {
      // If order_index is not provided, get the next available index
      if (order_index === undefined) {
        const { rows } = await query(
          `SELECT COALESCE(MAX(order_index), -1) + 1 as next_index FROM lessons WHERE module_id = $1`,
          [module_id]
        );
        order_index = rows[0].next_index;
      }

      // Determine content columns based on content_type
      let content_text = null;
      let content_url = null;
      
      if (content_type === 'video' && video_url) {
        content_url = video_url;
      } else if (content) {
        content_text = content;
      }

      // FIXED: Remove description column and add is_published
      // In the create method, around line 29:
      const { rows } = await query(
        `INSERT INTO lessons (title, content_text, content_url, content_type, module_id, order_index, duration, is_free, is_published) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [title, content_text, content_url, content_type || 'text', module_id, order_index, 
         duration ? parseInt(duration) : null, // Convert to integer or null
         is_free || false, true]
      );

      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Get all lessons for a module
  async findByModule(moduleId) {
    try {
      const { rows } = await query(
        `SELECT * FROM lessons WHERE module_id = $1 ORDER BY order_index ASC`,
        [moduleId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get lesson by ID
  async findById(id) {
    try {
      const { rows } = await query(
        `SELECT * FROM lessons WHERE id = $1`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Update lesson
  async update(id, { title, content, content_type, order_index, duration }) {
    try {
      // Build the query dynamically based on provided fields
      const fields = Object.entries({ 
        title, 
        content, 
        content_type,
        order_index,
        duration,
        updated_at: 'CURRENT_TIMESTAMP'
      }).filter(([_, value]) => value !== undefined);

      if (fields.length === 0) return await this.findById(id); // No fields to update
      
      const setClause = fields.map(([field, _], index) => 
        field === 'updated_at' ? `${field} = ${_}` : `${field} = $${index + 2}`
      ).join(', ');
      
      const values = fields
        .filter(([field, _]) => field !== 'updated_at')
        .map(([_, value]) => value);
      
      const { rows } = await query(
        `UPDATE lessons SET ${setClause} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete lesson
  async delete(id) {
    try {
      // First, get the lesson to know its module_id and order_index
      const lesson = await this.findById(id);
      if (!lesson) return null;

      // Delete the lesson
      const { rows } = await query(
        `DELETE FROM lessons WHERE id = $1 RETURNING *`,
        [id]
      );

      // Reorder remaining lessons
      await query(
        `UPDATE lessons 
         SET order_index = order_index - 1, updated_at = CURRENT_TIMESTAMP 
         WHERE module_id = $1 AND order_index > $2`,
        [lesson.module_id, lesson.order_index]
      );

      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Reorder lessons
  async reorder(lessonId, newOrderIndex) {
    try {
      // Get the lesson to be reordered
      const lesson = await this.findById(lessonId);
      if (!lesson) throw new Error('Lesson not found');

      const oldOrderIndex = lesson.order_index;
      
      // If the order hasn't changed, do nothing
      if (oldOrderIndex === newOrderIndex) {
        return lesson;
      }

      // Begin transaction
      await query('BEGIN');

      // Update other lessons' order
      if (newOrderIndex > oldOrderIndex) {
        // Moving down: decrement lessons in between
        await query(
          `UPDATE lessons 
           SET order_index = order_index - 1, updated_at = CURRENT_TIMESTAMP 
           WHERE module_id = $1 AND order_index > $2 AND order_index <= $3`,
          [lesson.module_id, oldOrderIndex, newOrderIndex]
        );
      } else {
        // Moving up: increment lessons in between
        await query(
          `UPDATE lessons 
           SET order_index = order_index + 1, updated_at = CURRENT_TIMESTAMP 
           WHERE module_id = $1 AND order_index >= $2 AND order_index < $3`,
          [lesson.module_id, newOrderIndex, oldOrderIndex]
        );
      }

      // Update the lesson's order
      const { rows } = await query(
        `UPDATE lessons SET order_index = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [lessonId, newOrderIndex]
      );

      // Commit transaction
      await query('COMMIT');

      return rows[0];
    } catch (error) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw error;
    }
  },

  // Get all lessons for a course
  async findByCourse(courseId) {
    try {
      const { rows } = await query(
        `SELECT l.* 
         FROM lessons l
         JOIN modules m ON l.module_id = m.id
         WHERE m.course_id = $1
         ORDER BY m.order_index ASC, l.order_index ASC`,
        [courseId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get lesson with progress for a specific user
  async findWithProgress(lessonId, userId) {
    try {
      // Get the lesson
      const lesson = await this.findById(lessonId);
      if (!lesson) return null;

      // Get the progress for this lesson and user
      const { rows } = await query(
        `SELECT * FROM lesson_progress WHERE lesson_id = $1 AND user_id = $2`,
        [lessonId, userId]
      );

      const progress = rows[0] || { is_completed: false };

      // Combine lesson with progress
      return {
        ...lesson,
        progress
      };
    } catch (error) {
      throw error;
    }
  },

  // Mark lesson as completed for a user
  async markCompleted(lessonId, userId) {
    try {
      // Check if progress record already exists
      const { rows: existing } = await query(
        `SELECT * FROM lesson_progress WHERE lesson_id = $1 AND user_id = $2`,
        [lessonId, userId]
      );

      if (existing.length > 0) {
        // Update existing record
        const { rows } = await query(
          `UPDATE lesson_progress 
           SET is_completed = true, completed_at = CURRENT_TIMESTAMP 
           WHERE lesson_id = $1 AND user_id = $2 
           RETURNING *`,
          [lessonId, userId]
        );
        return rows[0];
      } else {
        // Create new record
        const { rows } = await query(
          `INSERT INTO lesson_progress (lesson_id, user_id, is_completed, completed_at) 
           VALUES ($1, $2, true, CURRENT_TIMESTAMP) 
           RETURNING *`,
          [lessonId, userId]
        );
        return rows[0];
      }
    } catch (error) {
      throw error;
    }
  },

  // Get course progress for a user
  async getCourseProgress(courseId, userId) {
    try {
      // Get total number of lessons in the course
      const { rows: totalRows } = await query(
        `SELECT COUNT(*) as total_lessons 
         FROM lessons l
         JOIN modules m ON l.module_id = m.id
         WHERE m.course_id = $1`,
        [courseId]
      );
      const totalLessons = parseInt(totalRows[0].total_lessons);

      // Get number of completed lessons
      const { rows: completedRows } = await query(
        `SELECT COUNT(*) as completed_lessons 
         FROM lesson_progress lp
         JOIN lessons l ON lp.lesson_id = l.id
         JOIN modules m ON l.module_id = m.id
         WHERE m.course_id = $1 AND lp.user_id = $2 AND lp.is_completed = true`,
        [courseId, userId]
      );
      const completedLessons = parseInt(completedRows[0].completed_lessons);

      // Calculate progress percentage
      const progressPercentage = totalLessons > 0 
        ? Math.round((completedLessons / totalLessons) * 100) 
        : 0;

      return {
        totalLessons,
        completedLessons,
        progressPercentage
      };
    } catch (error) {
      throw error;
    }
  },

  // Check if user is enrolled in a course
  async isUserEnrolledInCourse(userId, courseId) {
    try {
      const { rows } = await query(
        `SELECT COUNT(*) as count 
         FROM enrollments 
         WHERE user_id = $1 AND course_id = $2 AND status = 'active'`,
        [userId, courseId]
      );
      return parseInt(rows[0].count) > 0;
    } catch (error) {
      throw error;
    }
  }
};

export default LessonModel;
