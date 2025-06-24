import { query } from "../config/db.js";

const EnrollmentModel = {
  // Enroll a user in a course
  async create({ user_id, course_id }) {
    try {
      // Check if enrollment already exists
      const existingEnrollment = await this.findByUserAndCourse(user_id, course_id);
      if (existingEnrollment) {
        return existingEnrollment;
      }

      const { rows } = await query(
        `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) RETURNING *`,
        [user_id, course_id]
      );

      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Get enrollment by ID
  async findById(id) {
    try {
      const { rows } = await query(
        `SELECT e.*, c.title as course_title, u.name as user_name 
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         JOIN users u ON e.user_id = u.id
         WHERE e.id = $1`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Find enrollment by user and course
  async findByUserAndCourse(userId, courseId) {
    try {
      const { rows } = await query(
        `SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2`,
        [userId, courseId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Get all enrollments for a user
  async findByUser(userId, { limit = 20, offset = 0 } = {}) {
    try {
      const { rows } = await query(
        `SELECT e.*, c.title as course_title, cat.name as category,
                u.name as instructor_name
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE e.user_id = $1
         ORDER BY e.enrolled_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get all enrollments for a course
  async findByCourse(courseId, { limit = 20, offset = 0 } = {}) {
    try {
      const { rows } = await query(
        `SELECT e.*, u.name as user_name, u.email as user_email
         FROM enrollments e
         JOIN users u ON e.user_id = u.id
         WHERE e.course_id = $1
         ORDER BY e.enrolled_at DESC
         LIMIT $2 OFFSET $3`,
        [courseId, limit, offset]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Update enrollment progress
  async updateProgress(id, progress) {
    try {
      const { rows } = await query(
        `UPDATE enrollments SET progress = $2 WHERE id = $1 RETURNING *`,
        [id, progress]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Mark enrollment as completed
  async markCompleted(id) {
    try {
      const { rows } = await query(
        `UPDATE enrollments 
         SET status = 'completed', progress = 100, completed_at = CURRENT_TIMESTAMP 
         WHERE id = $1 RETURNING *`,
        [id]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Update enrollment status
  async updateStatus(id, status) {
    try {
      const { rows } = await query(
        `UPDATE enrollments SET status = $2 WHERE id = $1 RETURNING *`,
        [id, status]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete enrollment (unenroll)
  async delete(id) {
    try {
      const { rows } = await query(
        `DELETE FROM enrollments WHERE id = $1 RETURNING *`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Count enrollments for a course
  async countByCourse(courseId) {
    try {
      const { rows } = await query(
        `SELECT COUNT(*) FROM enrollments WHERE course_id = $1`,
        [courseId]
      );
      return parseInt(rows[0].count);
    } catch (error) {
      throw error;
    }
  },

  // Count enrollments for a user
  async countByUser(userId) {
    try {
      const { rows } = await query(
        `SELECT COUNT(*) FROM enrollments WHERE user_id = $1`,
        [userId]
      );
      return parseInt(rows[0].count);
    } catch (error) {
      throw error;
    }
  },

  // Check if a user is enrolled in a course
  async isEnrolled(userId, courseId) {
    try {
      const enrollment = await this.findByUserAndCourse(userId, courseId);
      return !!enrollment;
    } catch (error) {
      throw error;
    }
  },

  // Get enrollment with course details
  async findWithCourseDetails(enrollmentId) {
    try {
      const { rows } = await query(
        `SELECT e.*, c.title as course_title, c.description as course_description,
                cat.name as category, u.name as instructor_name
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE e.id = $1`,
        [enrollmentId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Get recent enrollments (for dashboard)
  async getRecentEnrollments(limit = 5) {
    try {
      const { rows } = await query(
        `SELECT e.*, c.title as course_title, u.name as user_name
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         JOIN users u ON e.user_id = u.id
         ORDER BY e.enrolled_at DESC
         LIMIT $1`,
        [limit]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get enrollment statistics
  async getStatistics() {
    try {
      // Total enrollments
      const { rows: totalRows } = await query(
        `SELECT COUNT(*) as total FROM enrollments`
      );
      const total = parseInt(totalRows[0].total);

      // Enrollments by status
      const { rows: statusRows } = await query(
        `SELECT status, COUNT(*) as count 
         FROM enrollments 
         GROUP BY status`
      );
      const byStatus = statusRows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {});

      // Enrollments by month (last 6 months)
      const { rows: monthlyRows } = await query(
        `SELECT TO_CHAR(enrolled_at, 'YYYY-MM') as month, COUNT(*) as count 
         FROM enrollments 
         WHERE enrolled_at > CURRENT_DATE - INTERVAL '6 months' 
         GROUP BY month 
         ORDER BY month`
      );
      const byMonth = monthlyRows.reduce((acc, row) => {
        acc[row.month] = parseInt(row.count);
        return acc;
      }, {});

      return {
        total,
        byStatus,
        byMonth
      };
    } catch (error) {
      throw error;
    }
  },

  // Get all enrollments for courses taught by an instructor
  async findEnrollmentsByInstructor(instructorId, { limit = 50, offset = 0 } = {}) {
    try {
      const { rows } = await query(
        `SELECT e.id as enrollment_id,
                e.user_id,
                e.course_id,
                e.progress,
                e.status,
                e.enrolled_at,
                e.completed_at,
                u.name as student_name,
                u.email as student_email,
                c.title as course_title,
                cat.name as course_category,
                c.id as course_id
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         JOIN users u ON e.user_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.instructor_id = $1
         ORDER BY e.enrolled_at DESC
         LIMIT $2 OFFSET $3`,
        [instructorId, limit, offset]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Count enrollments for instructor's courses
  async countEnrollmentsByInstructor(instructorId) {
    try {
      const { rows } = await query(
        `SELECT COUNT(*) as count
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE c.instructor_id = $1`,
        [instructorId]
      );
      return parseInt(rows[0].count);
    } catch (error) {
      throw error;
    }
  },

  // Get comprehensive stats for instructor's courses
  async getStatsForInstructor(instructorId) {
    try {
      // Total enrollments across all instructor's courses
      const { rows: totalRows } = await query(
        `SELECT COUNT(*) as total_enrollments
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE c.instructor_id = $1`,
        [instructorId]
      );

      // Enrollments by status
      const { rows: statusRows } = await query(
        `SELECT e.status, COUNT(*) as count
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE c.instructor_id = $1
         GROUP BY e.status`,
        [instructorId]
      );

      // Enrollments by course
      const { rows: courseRows } = await query(
        `SELECT c.title as course_title, 
                c.id as course_id,
                COUNT(e.id) as enrollment_count,
                AVG(e.progress) as avg_progress
         FROM courses c
         LEFT JOIN enrollments e ON c.id = e.course_id
         WHERE c.instructor_id = $1
         GROUP BY c.id, c.title
         ORDER BY enrollment_count DESC`,
        [instructorId]
      );

      // Recent enrollments (last 30 days)
      const { rows: recentRows } = await query(
        `SELECT COUNT(*) as recent_enrollments
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE c.instructor_id = $1 
         AND e.enrolled_at > CURRENT_DATE - INTERVAL '30 days'`,
        [instructorId]
      );

      // Completion rate
      const { rows: completionRows } = await query(
        `SELECT 
           COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as completed,
           COUNT(*) as total
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE c.instructor_id = $1`,
        [instructorId]
      );

      // Progress distribution
      const { rows: progressRows } = await query(
        `SELECT 
           COUNT(CASE WHEN e.progress = 0 THEN 1 END) as not_started,
           COUNT(CASE WHEN e.progress > 0 AND e.progress < 50 THEN 1 END) as in_progress_low,
           COUNT(CASE WHEN e.progress >= 50 AND e.progress < 100 THEN 1 END) as in_progress_high,
           COUNT(CASE WHEN e.progress = 100 THEN 1 END) as completed
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE c.instructor_id = $1`,
        [instructorId]
      );

      // Format the results
      const totalEnrollments = parseInt(totalRows[0].total_enrollments);
      const recentEnrollments = parseInt(recentRows[0].recent_enrollments);
      const completionData = completionRows[0];
      const completionRate = totalEnrollments > 0 
        ? ((parseInt(completionData.completed) / parseInt(completionData.total)) * 100).toFixed(2)
        : 0;

      const byStatus = statusRows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {});

      const byCourse = courseRows.map(row => ({
        courseId: row.course_id,
        courseTitle: row.course_title,
        enrollmentCount: parseInt(row.enrollment_count),
        avgProgress: row.avg_progress ? parseFloat(row.avg_progress).toFixed(2) : 0
      }));

      const progressDistribution = progressRows[0] ? {
        notStarted: parseInt(progressRows[0].not_started),
        inProgressLow: parseInt(progressRows[0].in_progress_low),
        inProgressHigh: parseInt(progressRows[0].in_progress_high),
        completed: parseInt(progressRows[0].completed)
      } : {};

      return {
        totalEnrollments,
        recentEnrollments,
        completionRate: parseFloat(completionRate),
        byStatus,
        byCourse,
        progressDistribution
      };
    } catch (error) {
      throw error;
    }
  }
};

export default EnrollmentModel;