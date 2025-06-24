import { query } from '../config/db.js';

const AssignmentModel = {
  // Create a new assignment
  async create({ title, description, instructions = null, lesson_id, course_id, due_date = null, max_score = 100, is_published = false, file_requirements = null }) {
    try {
      const { rows } = await query(
        `INSERT INTO assignments 
         (title, description, instructions, lesson_id, course_id, due_date, max_score, is_published, file_requirements) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [title, description, instructions, lesson_id, course_id, due_date, max_score, is_published, file_requirements]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Get assignment by ID
  async findById(id) {
    try {
      const { rows } = await query(
        `SELECT a.*, l.title as lesson_title, m.id as module_id, m.title as module_title, c.id as course_id, c.title as course_title
         FROM assignments a
         JOIN lessons l ON a.lesson_id = l.id
         JOIN modules m ON l.module_id = m.id
         JOIN courses c ON m.course_id = c.id
         WHERE a.id = $1`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Get assignments by lesson ID
  async findByLessonId(lessonId) {
    try {
      const { rows } = await query(
        `SELECT * FROM assignments WHERE lesson_id = $1 ORDER BY created_at`,
        [lessonId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get assignments by course ID
  async findByCourseId(courseId) {
    try {
      const { rows } = await query(
        `SELECT a.* 
         FROM assignments a
         JOIN lessons l ON a.lesson_id = l.id
         JOIN modules m ON l.module_id = m.id
         WHERE m.course_id = $1
         ORDER BY m.order_index, l.order_index, a.created_at`,
        [courseId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Update assignment
  async update(id, updates) {
    const { title, description, due_date, max_score, is_published, file_requirements } = updates;
    
    try {
      const { rows } = await query(
        `UPDATE assignments 
         SET title = COALESCE($2, title),
             description = COALESCE($3, description),
             due_date = COALESCE($4, due_date),
             max_score = COALESCE($5, max_score),
             is_published = COALESCE($6, is_published),
             file_requirements = COALESCE($7, file_requirements),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, title, description, due_date, max_score, is_published, file_requirements]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete assignment
  async delete(id) {
    try {
      // First delete all related submissions
      await query(
        `DELETE FROM submissions WHERE assignment_id = $1`,
        [id]
      );
      
      // Then delete the assignment
      const { rows } = await query(
        `DELETE FROM assignments WHERE id = $1 RETURNING *`,
        [id]
      );
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Submit an assignment with late submission detection
  async submitAssignment({ assignment_id, student_id, submission_text = null, file_url = null }) {
    try {
      // Get assignment to check due date
      const assignment = await this.findById(assignment_id);
      if (!assignment) {
        throw new Error('Assignment not found');
      }

      // Check if submission is late
      const now = new Date();
      const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
      const is_late = dueDate && now > dueDate;

      // Check if a submission already exists
      const { rows: existingRows } = await query(
        `SELECT * FROM assignment_submissions 
         WHERE assignment_id = $1 AND student_id = $2`,
        [assignment_id, student_id]
      );
      
      if (existingRows.length > 0) {
        // Update existing submission
        const { rows } = await query(
          `UPDATE assignment_submissions 
           SET submission_text = $3,
               file_url = $4,
               submitted_at = CURRENT_TIMESTAMP,
               status = 'submitted',
               is_late = $5
           WHERE assignment_id = $1 AND student_id = $2
           RETURNING *`,
          [assignment_id, student_id, submission_text, file_url, is_late]
        );
        return { ...rows[0], isNew: false };
      } else {
        // Create new submission
        const { rows } = await query(
          `INSERT INTO assignment_submissions 
           (assignment_id, student_id, submission_text, file_url, status, is_late) 
           VALUES ($1, $2, $3, $4, 'submitted', $5) 
           RETURNING *`,
          [assignment_id, student_id, submission_text, file_url, is_late]
        );
        return { ...rows[0], isNew: true };
      }
    } catch (error) {
      throw error;
    }
  },

  // Grade an assignment submission
  async gradeSubmission(submissionId, { score, feedback = null, graded_by }) {
    try {
      const { rows } = await query(
        `UPDATE assignment_submissions 
         SET score = $2,
             feedback = $3,
             graded_by = $4,
             graded_at = CURRENT_TIMESTAMP,
             status = 'graded'
         WHERE id = $1
         RETURNING *`,
        [submissionId, score, feedback, graded_by]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Get submission by ID
  async getSubmissionById(submissionId) {
    try {
      const { rows } = await query(
        `SELECT s.*, a.title as assignment_title, a.max_score,
                u.name as user_name, u.email as user_email,
                g.name as grader_name
         FROM assignment_submissions s
         JOIN assignments a ON s.assignment_id = a.id
         JOIN users u ON s.student_id = u.id
         LEFT JOIN users g ON s.graded_by = g.id
         WHERE s.id = $1`,
        [submissionId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Get submission by assignment and user
  async getSubmissionByAssignmentAndUser(assignmentId, userId) {
    try {
      const { rows } = await query(
        `SELECT * FROM assignment_submissions 
         WHERE assignment_id = $1 AND student_id = $2`,
        [assignmentId, userId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Get all submissions for an assignment
  async getSubmissionsByAssignment(assignmentId) {
    try {
      const { rows } = await query(
        `SELECT s.*, u.name as user_name, u.email as user_email,
                g.name as grader_name
         FROM assignment_submissions s
         JOIN users u ON s.student_id = u.id
         LEFT JOIN users g ON s.graded_by = g.id
         WHERE s.assignment_id = $1
         ORDER BY s.submitted_at DESC`,
        [assignmentId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get all submissions for a user
  async getSubmissionsByUser(userId, courseId = null) {
    try {
      let queryText = `
        SELECT s.*, a.title as assignment_title, a.max_score, a.due_date,
               l.title as lesson_title, c.id as course_id, c.title as course_title,
               g.name as grader_name
        FROM assignment_submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN lessons l ON a.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        JOIN courses c ON m.course_id = c.id
        LEFT JOIN users g ON s.graded_by = g.id
        WHERE s.student_id = $1
      `;
      
      const queryParams = [userId];
      
      if (courseId) {
        queryText += ` AND c.id = $2`;
        queryParams.push(courseId);
      }
      
      queryText += ` ORDER BY s.submitted_at DESC`;
      
      const { rows } = await query(queryText, queryParams);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get pending submissions (not graded yet)
  async getPendingSubmissions(courseId = null) {
    try {
      let queryText = `
        SELECT s.*, a.title as assignment_title, a.max_score,
               u.name as user_name, u.email as user_email,
               l.title as lesson_title, c.id as course_id, c.title as course_title
        FROM assignment_submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN users u ON s.student_id = u.id
        JOIN lessons l ON a.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        JOIN courses c ON m.course_id = c.id
        WHERE s.status = 'submitted'
      `;
      
      const queryParams = [];
      
      if (courseId) {
        queryText += ` AND c.id = $1`;
        queryParams.push(courseId);
      }
      
      queryText += ` ORDER BY s.submitted_at ASC`;
      
      const { rows } = await query(queryText, queryParams);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get assignment statistics
  async getStatistics(assignmentId) {
    try {
      // Get total submissions
      const { rows: totalRows } = await query(
        `SELECT COUNT(*) as total_submissions,
                COUNT(DISTINCT student_id) as unique_users
         FROM assignment_submissions
         WHERE assignment_id = $1`,
        [assignmentId]
      );
      
      // Get average score for graded submissions
      const { rows: avgRows } = await query(
        `SELECT AVG(score) as average_score
         FROM assignment_submissions
         WHERE assignment_id = $1 AND status = 'graded'`,
        [assignmentId]
      );
      
      // Get submission status counts
      const { rows: statusRows } = await query(
        `SELECT status, COUNT(*) as count
         FROM assignment_submissions
         WHERE assignment_id = $1
         GROUP BY status`,
        [assignmentId]
      );
      
      const statusCounts = statusRows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {});
      
      return {
        totalSubmissions: parseInt(totalRows[0].total_submissions),
        uniqueUsers: parseInt(totalRows[0].unique_users),
        averageScore: parseFloat(avgRows[0].average_score) || 0,
        statusCounts
      };
    } catch (error) {
      throw error;
    }
  },

  // Check if a user has submitted an assignment
  async hasUserSubmitted(userId, assignmentId) {
    try {
      const { rows } = await query(
        `SELECT EXISTS(
           SELECT 1 FROM assignment_submissions 
           WHERE student_id = $1 AND assignment_id = $2
         ) as has_submitted`,
        [userId, assignmentId]
      );
      return rows[0].has_submitted;
    } catch (error) {
      throw error;
    }
  },

  // Get assignments due soon for a user
  async getAssignmentsDueSoon(userId, days = 7) {
    try {
      const { rows } = await query(
        `SELECT a.*, l.title as lesson_title, c.id as course_id, c.title as course_title,
                s.id as submission_id, s.status as submission_status
         FROM assignments a
         JOIN lessons l ON a.lesson_id = l.id
         JOIN modules m ON l.module_id = m.id
         JOIN courses c ON m.course_id = c.id
         JOIN enrollments e ON c.id = e.course_id
         LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = e.user_id
         WHERE e.user_id = $1
           AND a.is_published = true
           AND a.due_date IS NOT NULL
           AND a.due_date > CURRENT_TIMESTAMP
           AND a.due_date <= CURRENT_TIMESTAMP + INTERVAL '$2 days'
           AND (s.id IS NULL OR s.status != 'graded')
         ORDER BY a.due_date ASC`,
        [userId, days]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get overdue assignments for a user
  async getOverdueAssignments(userId) {
    try {
      const { rows } = await query(
        `SELECT a.*, l.title as lesson_title, c.id as course_id, c.title as course_title,
                s.id as submission_id, s.status as submission_status
         FROM assignments a
         JOIN lessons l ON a.lesson_id = l.id
         JOIN modules m ON l.module_id = m.id
         JOIN courses c ON m.course_id = c.id
         JOIN enrollments e ON c.id = e.course_id
         LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = e.user_id
         WHERE e.user_id = $1
           AND a.is_published = true
           AND a.due_date IS NOT NULL
           AND a.due_date < CURRENT_TIMESTAMP
           AND (s.id IS NULL OR s.status != 'graded')
         ORDER BY a.due_date ASC`,
        [userId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }
};

export default AssignmentModel;