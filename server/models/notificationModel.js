import { query } from '../config/db.js';

const NotificationModel = {
  // Create a new notification
  async create({ user_id, title, message, type, related_id = null, is_read = false }) {
    // Add validation at the start
    if (!title || !message || !type) {
      throw new Error('Title, message, and type are required');
    }
    
    try {
      const { rows } = await query(
        `INSERT INTO notifications 
         (user_id, title, message, type, related_id, is_read) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [user_id, title, message, type, related_id, is_read]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Create notifications for multiple users (bulk create)
  async createBulk(notifications) {
    try {
      if (!notifications || notifications.length === 0) {
        return [];
      }

      // Validate that all notifications have required fields
      for (const notification of notifications) {
        if (!notification.title || !notification.message) {
          throw new Error('Title and message are required for all notifications');
        }
      }

      // Use individual inserts to avoid SQL injection and handle null values properly
      const results = [];
      for (const notification of notifications) {
        const result = await this.create({
          user_id: notification.user_id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          related_id: notification.related_id || null,
          is_read: notification.is_read || false
        });
        results.push(result);
      }

      return results;
    } catch (error) {
      throw error;
    }
  },

  // Get notification by ID
  async findById(id) {
    try {
      const { rows } = await query(
        `SELECT * FROM notifications WHERE id = $1`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Get notifications for a user
  async findByUser(userId, { limit = 20, offset = 0, includeRead = false } = {}) {
    try {
      let queryText = `SELECT * FROM notifications WHERE user_id = $1`;
      const queryParams = [userId];

      if (!includeRead) {
        queryText += ` AND is_read = false`;
      }

      queryText += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
      queryParams.push(limit, offset);

      const { rows } = await query(queryText, queryParams);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Mark a notification as read
  async markAsRead(id) {
    try {
      const { rows } = await query(
        `UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *`,
        [id]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Mark all notifications as read for a user
  async markAllAsRead(userId) {
    try {
      const { rows } = await query(
        `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false RETURNING *`,
        [userId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Delete a notification
  async delete(id) {
    try {
      const { rows } = await query(
        `DELETE FROM notifications WHERE id = $1 RETURNING *`,
        [id]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete all notifications for a user
  async deleteAllForUser(userId) {
    try {
      const { rows } = await query(
        `DELETE FROM notifications WHERE user_id = $1 RETURNING *`,
        [userId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Count unread notifications for a user
  async countUnread(userId) {
    try {
      const { rows } = await query(
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
        [userId]
      );
      return parseInt(rows[0].count);
    } catch (error) {
      throw error;
    }
  },

  // Create a course announcement notification for all enrolled students
  async createCourseAnnouncement({ course_id, title, message, instructor_id }) {
    try {
      // Get all users enrolled in the course
      const { rows: enrolledUsers } = await query(
        `SELECT user_id FROM enrollments WHERE course_id = $1`,
        [course_id]
      );

      // Get course title for the notification
      const { rows: courseRows } = await query(
        `SELECT title FROM courses WHERE id = $1`,
        [course_id]
      );

      if (courseRows.length === 0) {
        throw new Error('Course not found');
      }

      const courseTitle = courseRows[0].title;
      const notificationTitle = `Announcement: ${title}`;
      const notificationMessage = message;

      // Create notifications for all enrolled users
      const notifications = enrolledUsers.map(user => ({
        user_id: user.user_id,
        title: notificationTitle,
        message: notificationMessage,
        type: 'course_announcement',
        related_id: course_id,
        is_read: false
      }));

      return await this.createBulk(notifications);
    } catch (error) {
      throw error;
    }
  },

  // Create assignment due notification for a student
  async createAssignmentDueNotification({ user_id, assignment_id }) {
    try {
      // Get assignment details
      const { rows: assignmentRows } = await query(
        `SELECT a.title, a.due_date, c.id as course_id, c.title as course_title
         FROM assignments a
         JOIN lessons l ON a.lesson_id = l.id
         JOIN modules m ON l.module_id = m.id
         JOIN courses c ON m.course_id = c.id
         WHERE a.id = $1`,
        [assignment_id]
      );

      if (assignmentRows.length === 0) {
        throw new Error('Assignment not found');
      }

      const assignment = assignmentRows[0];
      const title = `Assignment Due Soon: ${assignment.title}`;
      const message = `Your assignment "${assignment.title}" for course "${assignment.course_title}" is due on ${new Date(assignment.due_date).toLocaleString()}.`;

      return await this.create({
        user_id,
        title,
        message,
        type: 'assignment_due',
        related_id: assignment_id,
        is_read: false
      });
    } catch (error) {
      throw error;
    }
  },

  // Create assignment graded notification for a student
  async createAssignmentGradedNotification({ user_id, submission_id }) {
    try {
      // Get submission details with assignment and course info
      const { rows: submissionRows } = await query(
        `SELECT s.score, a.id as assignment_id, a.title as assignment_title, a.max_score,
                c.id as course_id, c.title as course_title
         FROM assignment_submissions s
         JOIN assignments a ON s.assignment_id = a.id
         JOIN lessons l ON a.lesson_id = l.id
         JOIN modules m ON l.module_id = m.id
         JOIN courses c ON m.course_id = c.id
         WHERE s.id = $1`,
        [submission_id]
      );

      if (submissionRows.length === 0) {
        throw new Error('Submission not found');
      }

      const submission = submissionRows[0];
      const title = `Assignment Graded: ${submission.assignment_title}`;
      const message = `Your assignment "${submission.assignment_title}" for course "${submission.course_title}" has been graded. You received ${submission.score}/${submission.max_score} points.`;

      return await this.create({
        user_id,
        title,
        message,
        type: 'assignment_graded',
        related_id: submission.assignment_id,
        is_read: false
      });
    } catch (error) {
      throw error;
    }
  },

  // Create course content update notification for enrolled students
  async createCourseContentUpdateNotification({ course_id, module_id = null, lesson_id = null, update_type, content_title }) {
    const safeContentTitle = (content_title || '').trim() || 'New Content';

    try {
      // Validate required parameters
      if (!course_id || !update_type) {
        throw new Error('Course ID and update type are required');
      }

      // Get all users enrolled in the course
      const { rows: enrolledUsers } = await query(
        `SELECT user_id FROM enrollments WHERE course_id = $1`,
        [course_id]
      );

      if (enrolledUsers.length === 0) {
        return []; // No enrolled users to notify
      }

      // Get course title
      const { rows: courseRows } = await query(
        `SELECT title FROM courses WHERE id = $1`,
        [course_id]
      );

      if (courseRows.length === 0) {
        throw new Error('Course not found');
      }

      const courseTitle = courseRows[0].title;
      let title, message, related_id;

      // Ensure content_title has a fallback value
      const safeContentTitle = content_title ?? 'New Content';

      switch (update_type) {
        case 'new_module':
          title = `New Module: ${safeContentTitle}`;
          message = `A new module "${safeContentTitle}" has been added to your course "${courseTitle}".`;
          related_id = module_id;
          break;
        case 'new_lesson':
          title = `New Lesson: ${safeContentTitle}`;
          message = `A new lesson "${safeContentTitle}" has been added to your course "${courseTitle}".`;
          related_id = lesson_id;
          break;
        case 'new_quiz':
          title = `New Quiz: ${safeContentTitle}`;
          message = `A new quiz "${safeContentTitle}" has been added to your course "${courseTitle}".`;
          related_id = lesson_id;
          break;
        case 'new_assignment':
          title = `New Assignment: ${safeContentTitle}`;
          message = `A new assignment "${safeContentTitle}" has been added to your course "${courseTitle}".`;
          related_id = lesson_id;
          break;
        default:
          title = `Course Update: ${courseTitle}`;
          message = `Your course "${courseTitle}" has been updated with new content.`;
          related_id = course_id;
      }

      // Create notifications for all enrolled users
      const notifications = enrolledUsers.map(user => ({
        user_id: user.user_id,
        title,
        message,
        type: 'course_update',
        related_id,
        is_read: false
      }));

      return await this.createBulk(notifications);
    } catch (error) {
      throw error;
    }
  },

  // Create enrollment confirmation notification
  async createEnrollmentNotification({ user_id, course_id }) {
    try {
      // Get course details
      const { rows: courseRows } = await query(
        `SELECT c.title, u.name as instructor_name
         FROM courses c
         JOIN users u ON c.instructor_id = u.id
         WHERE c.id = $1`,
        [course_id]
      );

      if (courseRows.length === 0) {
        throw new Error('Course not found');
      }

      const course = courseRows[0];
      const title = `Enrolled: ${course.title}`;
      const message = `You have successfully enrolled in "${course.title}" taught by ${course.instructor_name}.`;

      return await this.create({
        user_id,
        title,
        message,
        type: 'enrollment',
        related_id: course_id,
        is_read: false
      });
    } catch (error) {
      throw error;
    }
  },

  // Create system notification for all users or specific roles
  async createSystemNotification({ title, message, role = null }) {
    try {
      let userQuery = 'SELECT id FROM users';
      const queryParams = [];

      if (role) {
        userQuery += ' WHERE role = $1';
        queryParams.push(role);
      }

      const { rows: users } = await query(userQuery, queryParams);

      // Create notifications for all targeted users
      const notifications = users.map(user => ({
        user_id: user.id,
        title,
        message,
        type: 'system',
        related_id: null,
        is_read: false
      }));

      return await this.createBulk(notifications);
    } catch (error) {
      throw error;
    }
  }
};

export default NotificationModel;