

import { query } from '../config/db.js';

const QuizModel = {
  // Create a new quiz for a lesson
  async create({ title, description, lesson_id, time_limit = null, passing_score = 70, is_published = false }) {
    try {
      const { rows } = await query(
        `INSERT INTO quizzes 
         (title, description, lesson_id, time_limit, passing_score, is_published) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [title, description, lesson_id, time_limit, passing_score, is_published]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Add a question to a quiz
  async addQuestion({ quiz_id, question, question_type, options = null, correct_answer, explanation = null, points = 1, question_order }) {
    try {
      const { rows } = await query(
        `INSERT INTO quiz_questions 
         (quiz_id, question, question_type, options, correct_answer, explanation, points, question_order) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [quiz_id, question, question_type, JSON.stringify(options), correct_answer, explanation, points, question_order]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Update a quiz question
  async updateQuestion(questionId, { question, question_type, options, correct_answer, explanation, points }) {
    try {
      const { rows } = await query(
        `UPDATE quiz_questions 
         SET question = $2, question_type = $3, options = $4, correct_answer = $5, explanation = $6, points = $7
         WHERE id = $1 
         RETURNING *`,
        [questionId, question, question_type, JSON.stringify(options), correct_answer, explanation, points]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete a quiz question
  async deleteQuestion(questionId) {
    try {
      const { rows } = await query(
        `DELETE FROM quiz_questions WHERE id = $1 RETURNING *`,
        [questionId]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Get quiz by ID
  async findById(id, includeQuestions = false) {
    try {
      const { rows } = await query(
        `SELECT * FROM quizzes WHERE id = $1`,
        [id]
      );
      
      const quiz = rows[0];
      if (!quiz) return null;
      
      if (includeQuestions) {
        const { rows: questionRows } = await query(
          `SELECT * FROM quiz_questions 
           WHERE quiz_id = $1 
           ORDER BY question_order`,
          [id]
        );
        
        // Parse options JSON for each question
        for (const question of questionRows) {
          if (question.options) {
            question.options = typeof question.options === 'string' 
              ? JSON.parse(question.options) 
              : question.options;
          }
        }
        
        quiz.questions = questionRows;
      }
      
      return quiz;
    } catch (error) {
      throw error;
    }
  },

  // Get quizzes by lesson ID
  async findByLessonId(lessonId) {
    try {
      const { rows } = await query(
        `SELECT * FROM quizzes WHERE lesson_id = $1 ORDER BY created_at`,
        [lessonId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get quizzes by course ID
  async findByCourseId(courseId) {
    try {
      const { rows } = await query(
        `SELECT q.* 
         FROM quizzes q
         JOIN lessons l ON q.lesson_id = l.id
         JOIN modules m ON l.module_id = m.id
         WHERE m.course_id = $1
         ORDER BY m.order_index, l.order_index, q.created_at`,
        [courseId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Update quiz
  async update(id, updates) {
    const { title, description, time_limit, passing_score, is_published } = updates;
    
    try {
      const { rows } = await query(
        `UPDATE quizzes 
         SET title = COALESCE($2, title),
             description = COALESCE($3, description),
             time_limit = COALESCE($4, time_limit),
             passing_score = COALESCE($5, passing_score),
             is_published = COALESCE($6, is_published),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, title, description, time_limit, passing_score, is_published]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete quiz
  async delete(id) {
    try {
      // First delete all related quiz attempts
      await query(
        `DELETE FROM quiz_attempts WHERE quiz_id = $1`,
        [id]
      );
      
      // Then delete all related quiz options and questions
      const { rows: questionRows } = await query(
        `SELECT id FROM quiz_questions WHERE quiz_id = $1`,
        [id]
      );
      
      for (const question of questionRows) {
        await query(
          `DELETE FROM quiz_options WHERE question_id = $1`,
          [question.id]
        );
      }
      
      await query(
        `DELETE FROM quiz_questions WHERE quiz_id = $1`,
        [id]
      );
      
      // Finally delete the quiz
      const { rows } = await query(
        `DELETE FROM quizzes WHERE id = $1 RETURNING *`,
        [id]
      );
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Add a question to a quiz
  async addQuestion({ quiz_id, question_text, question_type, points = 1 }) {
    try {
      // Get the current highest question order
      const { rows: orderRows } = await query(
        `SELECT MAX(question_order) as max_order FROM quiz_questions WHERE quiz_id = $1`,
        [quiz_id]
      );
      
      const questionOrder = orderRows[0].max_order ? orderRows[0].max_order + 1 : 1;
      
      const { rows } = await query(
        `INSERT INTO quiz_questions 
         (quiz_id, question_text, question_type, points, question_order) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [quiz_id, question_text, question_type, points, questionOrder]
      );
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Update a question
  async updateQuestion(questionId, updates) {
    const { question_text, question_type, points } = updates;
    
    try {
      const { rows } = await query(
        `UPDATE quiz_questions 
         SET question_text = COALESCE($2, question_text),
             question_type = COALESCE($3, question_type),
             points = COALESCE($4, points)
         WHERE id = $1
         RETURNING *`,
        [questionId, question_text, question_type, points]
      );
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete a question
  async deleteQuestion(questionId) {
    try {
      // First get the question to find its quiz_id and order
      const { rows: questionRows } = await query(
        `SELECT * FROM quiz_questions WHERE id = $1`,
        [questionId]
      );
      
      if (questionRows.length === 0) return null;
      
      const question = questionRows[0];
      
      // Delete all options for this question
      await query(
        `DELETE FROM quiz_options WHERE question_id = $1`,
        [questionId]
      );
      
      // Delete the question
      const { rows } = await query(
        `DELETE FROM quiz_questions WHERE id = $1 RETURNING *`,
        [questionId]
      );
      
      // Reorder remaining questions
      await query(
        `UPDATE quiz_questions 
         SET question_order = question_order - 1 
         WHERE quiz_id = $1 AND question_order > $2`,
        [question.quiz_id, question.question_order]
      );
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Add an option to a question
  async addOption({ question_id, option_text, is_correct = false }) {
    try {
      // Get the current highest option order
      const { rows: orderRows } = await query(
        `SELECT MAX(option_order) as max_order FROM quiz_options WHERE question_id = $1`,
        [question_id]
      );
      
      const optionOrder = orderRows[0].max_order ? orderRows[0].max_order + 1 : 1;
      
      const { rows } = await query(
        `INSERT INTO quiz_options 
         (question_id, option_text, is_correct, option_order) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [question_id, option_text, is_correct, optionOrder]
      );
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Update an option
  async updateOption(optionId, updates) {
    const { option_text, is_correct } = updates;
    
    try {
      const { rows } = await query(
        `UPDATE quiz_options 
         SET option_text = COALESCE($2, option_text),
             is_correct = COALESCE($3, is_correct)
         WHERE id = $1
         RETURNING *`,
        [optionId, option_text, is_correct]
      );
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete an option
  async deleteOption(optionId) {
    try {
      // First get the option to find its question_id and order
      const { rows: optionRows } = await query(
        `SELECT * FROM quiz_options WHERE id = $1`,
        [optionId]
      );
      
      if (optionRows.length === 0) return null;
      
      const option = optionRows[0];
      
      // Delete the option
      const { rows } = await query(
        `DELETE FROM quiz_options WHERE id = $1 RETURNING *`,
        [optionId]
      );
      
      // Reorder remaining options
      await query(
        `UPDATE quiz_options 
         SET option_order = option_order - 1 
         WHERE question_id = $1 AND option_order > $2`,
        [option.question_id, option.option_order]
      );
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Record a quiz attempt
  async recordAttempt({ quiz_id, user_id, score, passed, time_taken = null, answers = null }) {
    try {
      const { rows } = await query(
        `INSERT INTO quiz_attempts 
         (quiz_id, user_id, score, passed, time_taken, answers, completed_at) 
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) 
         RETURNING *`,
        [quiz_id, user_id, score, passed, time_taken, answers]
      );
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Submit quiz attempt with auto-grading
  async submitAttempt({ quiz_id, user_id, answers, time_taken = null }) {
    try {
      // Get quiz with questions
      const quiz = await this.findById(quiz_id, true);
      if (!quiz) {
        throw new Error('Quiz not found');
      }

      // Calculate score
      let totalScore = 0;
      let totalPoints = 0;
      const gradedAnswers = [];

      for (const question of quiz.questions) {
        totalPoints += question.points;
        const userAnswer = answers.find(a => a.question_id === question.id);
        
        if (userAnswer) {
          const isCorrect = userAnswer.answer === question.correct_answer;
          if (isCorrect) {
            totalScore += question.points;
          }
          
          gradedAnswers.push({
            question_id: question.id,
            user_answer: userAnswer.answer,
            correct_answer: question.correct_answer,
            is_correct: isCorrect,
            points_earned: isCorrect ? question.points : 0,
            points_possible: question.points
          });
        } else {
          gradedAnswers.push({
            question_id: question.id,
            user_answer: null,
            correct_answer: question.correct_answer,
            is_correct: false,
            points_earned: 0,
            points_possible: question.points
          });
        }
      }

      // Calculate percentage and determine if passed
      const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
      const passed = percentage >= quiz.passing_score;

      // Save attempt
      const { rows } = await query(
        `INSERT INTO quiz_attempts 
         (quiz_id, user_id, score, total_points, passed, answers, completed_at, time_taken) 
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7) 
         RETURNING *`,
        [quiz_id, user_id, percentage, totalPoints, passed, JSON.stringify(gradedAnswers), time_taken]
      );

      return {
        ...rows[0],
        graded_answers: gradedAnswers,
        total_score: totalScore,
        total_points: totalPoints,
        percentage: percentage
      };
    } catch (error) {
      throw error;
    }
  },

  // Get quiz attempts by user
  async getAttemptsByUser(userId, quizId = null) {
    try {
      // Validate userId parameter
      if (!userId || isNaN(parseInt(userId))) {
        throw new Error('Invalid user ID parameter');
      }
      
      let queryText = `
        SELECT qa.*, q.title as quiz_title, q.passing_score,
               l.title as lesson_title, c.id as course_id, c.title as course_title
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN lessons l ON q.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        JOIN courses c ON m.course_id = c.id
        WHERE qa.user_id = $1
      `;
      
      const queryParams = [parseInt(userId)];
      
      if (quizId) {
        if (isNaN(parseInt(quizId))) {
          throw new Error('Invalid quiz ID parameter');
        }
        queryText += ` AND qa.quiz_id = $2`;
        queryParams.push(parseInt(quizId));
      }
      
      queryText += ` ORDER BY qa.started_at DESC`;
      
      const { rows } = await query(queryText, queryParams);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get quiz attempts by quiz
  async getAttemptsByQuiz(quizId) {
    try {
      const { rows } = await query(
        `SELECT qa.*, u.name as user_name, u.email as user_email
         FROM quiz_attempts qa
         JOIN users u ON qa.user_id = u.id
         WHERE qa.quiz_id = $1
         ORDER BY qa.started_at DESC`,
        [quizId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get best quiz attempt for a user
  async getBestAttempt(userId, quizId) {
    try {
      const { rows } = await query(
        `SELECT * FROM quiz_attempts 
         WHERE user_id = $1 AND quiz_id = $2 
         ORDER BY score DESC, time_taken ASC 
         LIMIT 1`,
        [userId, quizId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Check if a quiz has been passed by a user
  async hasUserPassed(userId, quizId) {
    try {
      const { rows } = await query(
        `SELECT EXISTS(
           SELECT 1 FROM quiz_attempts 
           WHERE user_id = $1 AND quiz_id = $2 AND passed = true
         ) as has_passed`,
        [userId, quizId]
      );
      return rows[0].has_passed;
    } catch (error) {
      throw error;
    }
  },

  // Get quiz statistics
  async getStatistics(quizId) {
    try {
      // Get total attempts
      const { rows: totalRows } = await query(
        `SELECT COUNT(*) as total_attempts,
                COUNT(DISTINCT user_id) as unique_users
         FROM quiz_attempts
         WHERE quiz_id = $1`,
        [quizId]
      );
      
      // Get average score
      const { rows: avgRows } = await query(
        `SELECT AVG(score) as average_score,
                AVG(time_taken) as average_time
         FROM quiz_attempts
         WHERE quiz_id = $1`,
        [quizId]
      );
      
      // Get pass rate
      const { rows: passRows } = await query(
        `SELECT 
           COUNT(*) FILTER (WHERE passed = true) as passed_count,
           COUNT(*) as total_count,
           CASE 
             WHEN COUNT(*) > 0 THEN 
               ROUND((COUNT(*) FILTER (WHERE passed = true) * 100.0 / COUNT(*)), 2)
             ELSE 0 
           END as pass_rate
         FROM quiz_attempts
         WHERE quiz_id = $1`,
        [quizId]
      );
      
      return {
        totalAttempts: parseInt(totalRows[0].total_attempts),
        uniqueUsers: parseInt(totalRows[0].unique_users),
        averageScore: parseFloat(avgRows[0].average_score) || 0,
        averageTime: parseFloat(avgRows[0].average_time) || 0,
        passRate: parseFloat(passRows[0].pass_rate) || 0,
        passedCount: parseInt(passRows[0].passed_count) || 0
      };
    } catch (error) {
      throw error;
    }
  },

  // Publish a quiz
  async publish(quizId) {
    try {
      const { rows } = await query(
        `UPDATE quizzes 
         SET is_published = true, 
             published_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [quizId]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Unpublish a quiz
  async unpublish(quizId) {
    try {
      const { rows } = await query(
        `UPDATE quizzes 
         SET is_published = false,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [quizId]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }
};

export default QuizModel;