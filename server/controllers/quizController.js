

import QuizModel from '../models/quizModel.js';
import LessonModel from '../models/lessonModel.js';
import ModuleModel from '../models/moduleModel.js';
import CourseModel from '../models/courseModel.js';
import NotificationModel from '../models/notificationModel.js';
import { createResponse } from '../utils/helper.js';

const quizController = {
  // Create a new quiz
  async createQuiz(req, res) {
    try {
      const { title, description, lesson_id, time_limit = null, passing_score = 70, is_published = false } = req.body;

      // Validate required fields
      if (!title || !lesson_id) {
        return res.status(400).json(createResponse(false, 'Title and lesson ID are required', null));
      }

      // Check if lesson exists
      const lesson = await LessonModel.findById(lesson_id);
      if (!lesson) {
        return res.status(404).json(createResponse(false, 'Lesson not found', null));
      }

      // Get module and course to check authorization
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to add quizzes to this lesson
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to add quizzes to this lesson', null));
      }

      // Create quiz
      const quiz = await QuizModel.create({
        title,
        description,
        lesson_id,
        time_limit,
        passing_score,
        is_published
      });

      return res.status(201).json(createResponse(true, 'Quiz created successfully', quiz));
    } catch (error) {
      console.error('Error creating quiz:', error);
      return res.status(500).json(createResponse(false, 'Failed to create quiz', null));
    }
  },

  // Get a quiz by ID
  async getQuizById(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user ? req.user.id : null;
      
      // Get quiz
      const quiz = await QuizModel.findById(id);
      
      if (!quiz) {
        return res.status(404).json(createResponse(false, 'Quiz not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);
      
      // Check if quiz is published or if user is admin/instructor
      const isAdminOrInstructor = req.user && (req.user.role === 'admin' || req.user.role === 'instructor');
      const isInstructor = req.user && course.instructor_id === req.user.id;
      const isEnrolled = user_id ? await LessonModel.isUserEnrolledInCourse(user_id, module.course_id) : false;
      
      if (!quiz.is_published && !isAdminOrInstructor && !isInstructor) {
        return res.status(403).json(createResponse(false, 'This quiz is not available', null));
      }

      // Get quiz with questions and options
      const quizWithQuestions = await QuizModel.findByIdWithQuestions(id);

      // If user is logged in and enrolled, get their attempts for this quiz
      let userAttempts = null;
      let bestAttempt = null;
      if (user_id && isEnrolled) {
        userAttempts = await QuizModel.getAttemptsByUserAndQuiz(user_id, id);
        bestAttempt = await QuizModel.getBestAttempt(user_id, id);
      }

      // For students, don't include correct answers if they haven't completed the quiz yet
      if (!isAdminOrInstructor && !isInstructor) {
        // Check if user has a completed attempt
        const hasCompletedAttempt = userAttempts && userAttempts.some(attempt => attempt.completed_at !== null);
        
        if (!hasCompletedAttempt) {
          // Remove correct_answer from options
          quizWithQuestions.questions.forEach(question => {
            question.options.forEach(option => {
              delete option.is_correct;
            });
          });
        }
      }

      return res.status(200).json(createResponse(true, 'Quiz retrieved successfully', {
        quiz: quizWithQuestions,
        userAttempts,
        bestAttempt
      }));
    } catch (error) {
      console.error('Error getting quiz:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve quiz', null));
    }
  },

  // Get quizzes by lesson
  async getQuizzesByLesson(req, res) {
    try {
      const { lesson_id } = req.params;
      const user_id = req.user ? req.user.id : null;

      // Check if lesson exists
      const lesson = await LessonModel.findById(lesson_id);
      if (!lesson) {
        return res.status(404).json(createResponse(false, 'Lesson not found', null));
      }

      // Get module and course
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check authorization
      const isAdminOrInstructor = req.user && (req.user.role === 'admin' || req.user.role === 'instructor');
      const isInstructor = req.user && course.instructor_id === req.user.id;
      const isEnrolled = user_id ? await LessonModel.isUserEnrolledInCourse(user_id, module.course_id) : false;

      // Get quizzes for this lesson
      let quizzes;
      if (isAdminOrInstructor || isInstructor) {
        // Admins and instructors can see all quizzes
        quizzes = await QuizModel.findByLesson(lesson_id);
      } else {
        // Students can only see published quizzes
        quizzes = await QuizModel.findByLesson(lesson_id, true);
      }

      // If user is logged in and enrolled, get their best attempts for each quiz
      if (user_id && isEnrolled) {
        for (const quiz of quizzes) {
          quiz.bestAttempt = await QuizModel.getBestAttempt(user_id, quiz.id);
          quiz.hasPassed = await QuizModel.hasUserPassed(user_id, quiz.id);
        }
      }

      return res.status(200).json(createResponse(true, 'Quizzes retrieved successfully', quizzes));
    } catch (error) {
      console.error('Error getting quizzes:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve quizzes', null));
    }
  },

  // Get quizzes by course ID
  async getQuizzesByCourse(req, res) {
    try {
      console.log('=== getQuizzesByCourse called ===');
      const { course_id } = req.params;
      const user_id = req.user ? req.user.id : null;
      console.log('Course ID:', course_id, 'User ID:', user_id);

      // Check if course exists
      console.log('Checking if course exists...');
      const course = await CourseModel.findById(course_id);
      console.log('Course found:', course ? 'Yes' : 'No');
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Check authorization
      const isAdminOrInstructor = req.user && (req.user.role === 'admin' || req.user.role === 'instructor');
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      let isEnrolled = false;
      try {
        isEnrolled = user_id ? await LessonModel.isUserEnrolledInCourse(user_id, course_id) : false;
        console.log('Enrollment check successful:', isEnrolled);
      } catch (enrollmentError) {
        console.error('Error checking enrollment:', enrollmentError);
        isEnrolled = false;
      }
      
      console.log('Authorization - Admin/Instructor:', isAdminOrInstructor, 'Is Course Instructor:', isInstructor, 'Is Enrolled:', isEnrolled);

      // Get quizzes for this course
      console.log('Fetching quizzes for course...');
      let quizzes;
      if (isAdminOrInstructor || isInstructor) {
        // Admins and instructors can see all quizzes
        quizzes = await QuizModel.findByCourseId(course_id);
      } else {
        // Students can only see published quizzes
        quizzes = await QuizModel.findByCourseId(course_id);
        quizzes = quizzes.filter(quiz => quiz.is_published);
      }
      console.log('Quizzes found:', quizzes ? quizzes.length : 0);

      // If user is logged in and enrolled, get their best attempts for each quiz
      if (user_id && isEnrolled) {
        console.log('Getting user attempts for quizzes...');
        for (const quiz of quizzes) {
          try {
            quiz.bestAttempt = await QuizModel.getBestAttempt(user_id, quiz.id);
            console.log(`Quiz ${quiz.id} - Best attempt retrieved:`, quiz.bestAttempt);
          } catch (attemptError) {
            console.error(`Error getting best attempt for quiz ${quiz.id}:`, attemptError);
            quiz.bestAttempt = null;
          }
          
          try {
            quiz.hasPassed = await QuizModel.hasUserPassed(user_id, quiz.id);
            console.log(`Quiz ${quiz.id} - Pass status:`, quiz.hasPassed);
          } catch (passError) {
            console.error(`Error checking pass status for quiz ${quiz.id}:`, passError);
            quiz.hasPassed = false;
          }
        }
      }

      console.log('=== getQuizzesByCourse completed successfully ===');
      return res.status(200).json(createResponse(true, 'Quizzes retrieved successfully', quizzes));
    } catch (error) {
      console.error('❌ CRITICAL ERROR in getQuizzesByCourse:');
      console.error('Error message:', error.message);
      console.error('Error name:', error.name);
      console.error('Error stack:', error.stack);
      console.error('Error code:', error.code);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve quizzes',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : null
      });
    }
  },

  // Update a quiz
  async updateQuiz(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Get the current quiz
      const quiz = await QuizModel.findById(id);
      
      if (!quiz) {
        return res.status(404).json(createResponse(false, 'Quiz not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to update this quiz
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to update this quiz', null));
      }

      // Update the quiz
      const updatedQuiz = await QuizModel.update(id, updates);

      return res.status(200).json(createResponse(true, 'Quiz updated successfully', updatedQuiz));
    } catch (error) {
      console.error('Error updating quiz:', error);
      return res.status(500).json(createResponse(false, 'Failed to update quiz', null));
    }
  },

  // Delete a quiz
  async deleteQuiz(req, res) {
    try {
      const { id } = req.params;
      
      // Get the current quiz
      const quiz = await QuizModel.findById(id);
      
      if (!quiz) {
        return res.status(404).json(createResponse(false, 'Quiz not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to delete this quiz
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to delete this quiz', null));
      }

      // Delete the quiz
      await QuizModel.delete(id);

      return res.status(200).json(createResponse(true, 'Quiz deleted successfully', null));
    } catch (error) {
      console.error('Error deleting quiz:', error);
      return res.status(500).json(createResponse(false, 'Failed to delete quiz', null));
    }
  },

  // Add a question to a quiz
  async addQuestion(req, res) {
    try {
      const { quiz_id } = req.params;
      const { text, question_type, points = 1, options = [] } = req.body;

      // Validate required fields
      if (!text || !question_type) {
        return res.status(400).json(createResponse(false, 'Question text and type are required', null));
      }

      // Check if quiz exists
      const quiz = await QuizModel.findById(quiz_id);
      if (!quiz) {
        return res.status(404).json(createResponse(false, 'Quiz not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to add questions to this quiz
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to add questions to this quiz', null));
      }

      // Validate options for multiple choice questions
      if (question_type === 'multiple_choice' && (!options || options.length < 2)) {
        return res.status(400).json(createResponse(false, 'Multiple choice questions must have at least 2 options', null));
      }

      // Check if at least one option is marked as correct for multiple choice
      if (question_type === 'multiple_choice' && !options.some(option => option.is_correct)) {
        return res.status(400).json(createResponse(false, 'At least one option must be marked as correct', null));
      }

      // Add question
      const question = await QuizModel.addQuestion(quiz_id, {
        text,
        question_type,
        points
      });

      // Add options if provided
      if (options && options.length > 0) {
        for (const option of options) {
          await QuizModel.addOption(question.id, option);
        }
      }

      // Get the question with options
      const questionWithOptions = await QuizModel.getQuestionWithOptions(question.id);

      return res.status(201).json(createResponse(true, 'Question added successfully', questionWithOptions));
    } catch (error) {
      console.error('Error adding question:', error);
      return res.status(500).json(createResponse(false, 'Failed to add question', null));
    }
  },

  // Update a question
  async updateQuestion(req, res) {
    try {
      const { question_id } = req.params;
      const updates = req.body;

      // Get the current question
      const question = await QuizModel.getQuestion(question_id);
      if (!question) {
        return res.status(404).json(createResponse(false, 'Question not found', null));
      }

      // Get quiz, lesson, module and course to check authorization
      const quiz = await QuizModel.findById(question.quiz_id);
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to update this question
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to update this question', null));
      }

      // Update the question
      const updatedQuestion = await QuizModel.updateQuestion(question_id, updates);

      return res.status(200).json(createResponse(true, 'Question updated successfully', updatedQuestion));
    } catch (error) {
      console.error('Error updating question:', error);
      return res.status(500).json(createResponse(false, 'Failed to update question', null));
    }
  },

  // Delete a question
  async deleteQuestion(req, res) {
    try {
      const { question_id } = req.params;

      // Get the current question
      const question = await QuizModel.getQuestion(question_id);
      if (!question) {
        return res.status(404).json(createResponse(false, 'Question not found', null));
      }

      // Get quiz, lesson, module and course to check authorization
      const quiz = await QuizModel.findById(question.quiz_id);
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to delete this question
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to delete this question', null));
      }

      // Delete the question
      await QuizModel.deleteQuestion(question_id);

      return res.status(200).json(createResponse(true, 'Question deleted successfully', null));
    } catch (error) {
      console.error('Error deleting question:', error);
      return res.status(500).json(createResponse(false, 'Failed to delete question', null));
    }
  },

  // Add an option to a question
  async addOption(req, res) {
    try {
      const { question_id } = req.params;
      const { text, is_correct = false } = req.body;

      // Validate required fields
      if (!text) {
        return res.status(400).json(createResponse(false, 'Option text is required', null));
      }

      // Get the current question
      const question = await QuizModel.getQuestion(question_id);
      if (!question) {
        return res.status(404).json(createResponse(false, 'Question not found', null));
      }

      // Get quiz, lesson, module and course to check authorization
      const quiz = await QuizModel.findById(question.quiz_id);
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to add options to this question
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to add options to this question', null));
      }

      // Add option
      const option = await QuizModel.addOption(question_id, { text, is_correct });

      return res.status(201).json(createResponse(true, 'Option added successfully', option));
    } catch (error) {
      console.error('Error adding option:', error);
      return res.status(500).json(createResponse(false, 'Failed to add option', null));
    }
  },

  // Update an option
  async updateOption(req, res) {
    try {
      const { option_id } = req.params;
      const updates = req.body;

      // Get the current option
      const option = await QuizModel.getOption(option_id);
      if (!option) {
        return res.status(404).json(createResponse(false, 'Option not found', null));
      }

      // Get question, quiz, lesson, module and course to check authorization
      const question = await QuizModel.getQuestion(option.question_id);
      const quiz = await QuizModel.findById(question.quiz_id);
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to update this option
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to update this option', null));
      }

      // Update the option
      const updatedOption = await QuizModel.updateOption(option_id, updates);

      return res.status(200).json(createResponse(true, 'Option updated successfully', updatedOption));
    } catch (error) {
      console.error('Error updating option:', error);
      return res.status(500).json(createResponse(false, 'Failed to update option', null));
    }
  },

  // Delete an option
  async deleteOption(req, res) {
    try {
      const { option_id } = req.params;

      // Get the current option
      const option = await QuizModel.getOption(option_id);
      if (!option) {
        return res.status(404).json(createResponse(false, 'Option not found', null));
      }

      // Get question, quiz, lesson, module and course to check authorization
      const question = await QuizModel.getQuestion(option.question_id);
      const quiz = await QuizModel.findById(question.quiz_id);
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to delete this option
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to delete this option', null));
      }

      // Delete the option
      await QuizModel.deleteOption(option_id);

      return res.status(200).json(createResponse(true, 'Option deleted successfully', null));
    } catch (error) {
      console.error('Error deleting option:', error);
      return res.status(500).json(createResponse(false, 'Failed to delete option', null));
    }
  },

  // Add question to quiz
  async addQuestion(req, res) {
    try {
      const { quiz_id } = req.params;
      const { question, question_type, options, correct_answer, explanation, points = 1 } = req.body;

      // Validate required fields
      if (!question || !question_type || !correct_answer) {
        return res.status(400).json(createResponse(false, 'Question, type, and correct answer are required', null));
      }

      // Get quiz to check authorization
      const quiz = await QuizModel.findById(quiz_id);
      if (!quiz) {
        return res.status(404).json(createResponse(false, 'Quiz not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to add questions to this quiz', null));
      }

      // Get next question order
      const existingQuestions = await QuizModel.findById(quiz_id, true);
      const question_order = existingQuestions.questions ? existingQuestions.questions.length + 1 : 1;

      // Add question
      const newQuestion = await QuizModel.addQuestion({
        quiz_id,
        question,
        question_type,
        options: question_type === 'multiple_choice' ? options : null,
        correct_answer,
        explanation,
        points,
        question_order
      });

      return res.status(201).json(createResponse(true, 'Question added successfully', newQuestion));
    } catch (error) {
      console.error('Error adding question:', error);
      return res.status(500).json(createResponse(false, 'Failed to add question', null));
    }
  },

  // Update question
  async updateQuestion(req, res) {
    try {
      const { question_id } = req.params;
      const { question, question_type, options, correct_answer, explanation, points } = req.body;

      // Get question to check authorization
      const { rows: questionRows } = await query(
        `SELECT qq.*, q.lesson_id FROM quiz_questions qq
         JOIN quizzes q ON qq.quiz_id = q.id
         WHERE qq.id = $1`,
        [question_id]
      );

      if (questionRows.length === 0) {
        return res.status(404).json(createResponse(false, 'Question not found', null));
      }

      const questionData = questionRows[0];
      const lesson = await LessonModel.findById(questionData.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check authorization
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to update this question', null));
      }

      // Update question
      const updatedQuestion = await QuizModel.updateQuestion(question_id, {
        question,
        question_type,
        options: question_type === 'multiple_choice' ? options : null,
        correct_answer,
        explanation,
        points
      });

      return res.status(200).json(createResponse(true, 'Question updated successfully', updatedQuestion));
    } catch (error) {
      console.error('Error updating question:', error);
      return res.status(500).json(createResponse(false, 'Failed to update question', null));
    }
  },

  // Delete question
  async deleteQuestion(req, res) {
    try {
      const { question_id } = req.params;

      // Get question to check authorization
      const { rows: questionRows } = await query(
        `SELECT qq.*, q.lesson_id FROM quiz_questions qq
         JOIN quizzes q ON qq.quiz_id = q.id
         WHERE qq.id = $1`,
        [question_id]
      );

      if (questionRows.length === 0) {
        return res.status(404).json(createResponse(false, 'Question not found', null));
      }

      const questionData = questionRows[0];
      const lesson = await LessonModel.findById(questionData.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check authorization
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to delete this question', null));
      }

      // Delete question
      await QuizModel.deleteQuestion(question_id);

      return res.status(200).json(createResponse(true, 'Question deleted successfully', null));
    } catch (error) {
      console.error('Error deleting question:', error);
      return res.status(500).json(createResponse(false, 'Failed to delete question', null));
    }
  },

  // Submit quiz attempt with auto-grading
  async submitQuizAttempt(req, res) {
    try {
      const { quiz_id } = req.params;
      const { answers, time_taken } = req.body;
      const user_id = req.user.id;

      // Validate required fields
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json(createResponse(false, 'Answers array is required', null));
      }

      // Check if quiz exists
      const quiz = await QuizModel.findById(quiz_id);
      if (!quiz) {
        return res.status(404).json(createResponse(false, 'Quiz not found', null));
      }

      // Check if quiz is published
      if (!quiz.is_published) {
        return res.status(403).json(createResponse(false, 'This quiz is not available', null));
      }

      // Get lesson, module and course to check enrollment
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const isEnrolled = await LessonModel.isUserEnrolledInCourse(user_id, module.course_id);

      if (!isEnrolled) {
        return res.status(403).json(createResponse(false, 'You must be enrolled in this course to take quizzes', null));
      }

      // Get quiz with questions and options
      const quizWithQuestions = await QuizModel.findByIdWithQuestions(quiz_id);

      // Calculate score
      let totalPoints = 0;
      let earnedPoints = 0;
      let correctAnswers = 0;

      // Create a map of question IDs to their correct options
      const questionMap = {};
      quizWithQuestions.questions.forEach(question => {
        totalPoints += question.points;
        questionMap[question.id] = {
          question,
          correctOptions: question.options.filter(option => option.is_correct).map(option => option.id)
        };
      });

      // Check each answer
      for (const answer of answers) {
        const { question_id, selected_options } = answer;
        
        if (questionMap[question_id]) {
          const { question, correctOptions } = questionMap[question_id];
          
          // For multiple choice, check if selected options match correct options
          if (question.question_type === 'multiple_choice') {
            // Convert to sets for comparison
            const selectedSet = new Set(selected_options);
            const correctSet = new Set(correctOptions);
            
            // Check if sets are equal (same size and all elements match)
            const isCorrect = selectedSet.size === correctSet.size && 
                             [...selectedSet].every(option => correctSet.has(option));
            
            if (isCorrect) {
              earnedPoints += question.points;
              correctAnswers++;
            }
          }
          // For true/false, check if the single selected option is correct
          else if (question.question_type === 'true_false') {
            if (selected_options.length === 1 && correctOptions.includes(selected_options[0])) {
              earnedPoints += question.points;
              correctAnswers++;
            }
          }
        }
      }

      // Calculate percentage score
      const percentageScore = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
      const isPassed = percentageScore >= quiz.passing_score;

      // Record the attempt
      const attempt = await QuizModel.recordAttempt({
        user_id,
        quiz_id,
        score: percentageScore,
        passed: isPassed,
        time_taken: null,
        answers: JSON.stringify(answers)
      });

      // If passed, mark the lesson as completed
      if (isPassed) {
        await LessonModel.markLessonCompleted(quiz.lesson_id, user_id);
        
        // Create notification for passing the quiz
        await NotificationModel.create({
          user_id,
          type: 'quiz_passed',
          title: 'Quiz Passed',
          message: `Congratulations! You passed the quiz: ${quiz.title} with a score of ${percentageScore.toFixed(1)}%`,
          related_id: quiz_id,
          is_read: false
        });
      }

      return res.status(200).json(createResponse(true, 'Quiz attempt submitted successfully', {
        attempt,
        details: {
          totalPoints,
          earnedPoints,
          percentageScore,
          isPassed,
          totalQuestions: quizWithQuestions.questions.length,
          correctAnswers
        }
      }));
    } catch (error) {
      console.error('Error submitting quiz attempt:', error);
      return res.status(500).json(createResponse(false, 'Failed to submit quiz attempt', null));
    }
  },

  // Get quiz attempts by user
  async getQuizAttemptsByUser(req, res) {
    try {
      const { user_id } = req.params;
      
      // Validate user_id parameter
      if (!user_id || isNaN(parseInt(user_id))) {
        return res.status(400).json(createResponse(false, 'Invalid user ID parameter', null));
      }
      
      // Validate authenticated user
      if (!req.user || !req.user.id) {
        return res.status(401).json(createResponse(false, 'Authentication required', null));
      }
      
      const requestingUserId = req.user.id;
      const isAdmin = req.user && req.user.role === 'admin';
      
      // Only allow users to view their own attempts unless they're an admin
      // Convert both to strings for comparison to handle type mismatches
      if (String(user_id) !== String(requestingUserId) && !isAdmin) {
        return res.status(403).json(createResponse(false, 'Not authorized to view these quiz attempts', null));
      }

      // Parse user_id to integer to prevent SQL injection
      const parsedUserId = parseInt(user_id);
      
      // Get attempts
      const attempts = await QuizModel.getAttemptsByUser(parsedUserId);
      
      return res.status(200).json(createResponse(true, 'Quiz attempts retrieved successfully', attempts));
    } catch (error) {
      console.error('Error getting quiz attempts:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve quiz attempts', null));
    }
  },

  // Get quiz attempts by quiz
  async getQuizAttemptsByQuiz(req, res) {
    try {
      const { quiz_id } = req.params;
      
      // Get quiz
      const quiz = await QuizModel.findById(quiz_id);
      if (!quiz) {
        return res.status(404).json(createResponse(false, 'Quiz not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to view attempts for this quiz
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to view attempts for this quiz', null));
      }

      // Get attempts
      const attempts = await QuizModel.getAttemptsByQuiz(quiz_id);

      return res.status(200).json(createResponse(true, 'Quiz attempts retrieved successfully', attempts));
    } catch (error) {
      console.error('Error getting quiz attempts:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve quiz attempts', null));
    }
  },

  // Get quiz statistics
  async getQuizStatistics(req, res) {
    try {
      const { quiz_id } = req.params;
      
      // Get quiz
      const quiz = await QuizModel.findById(quiz_id);
      if (!quiz) {
        return res.status(404).json(createResponse(false, 'Quiz not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to view statistics for this quiz
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to view statistics for this quiz', null));
      }

      // Get statistics
      const statistics = await QuizModel.getQuizStatistics(quiz_id);

      return res.status(200).json(createResponse(true, 'Quiz statistics retrieved successfully', statistics));
    } catch (error) {
      console.error('Error getting quiz statistics:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve quiz statistics', null));
    }
  },

  // Publish a quiz
  async publishQuiz(req, res) {
    try {
      const { id } = req.params;
      
      // Get quiz
      const quiz = await QuizModel.findById(id);
      if (!quiz) {
        return res.status(404).json(createResponse(false, 'Quiz not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to publish this quiz
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to publish this quiz', null));
      }

      // Check if quiz has questions
      const quizWithQuestions = await QuizModel.findByIdWithQuestions(id);
      if (!quizWithQuestions.questions || quizWithQuestions.questions.length === 0) {
        return res.status(400).json(createResponse(false, 'Cannot publish a quiz with no questions', null));
      }

      // Publish quiz
      const publishedQuiz = await QuizModel.publish(id);

      // Create notification for enrolled students
      await NotificationModel.createCourseContentUpdateNotification({
        course_id: module.course_id,
        quiz_id: id,
        update_type: 'new_quiz',
        content_title: quiz.title
      });

      return res.status(200).json(createResponse(true, 'Quiz published successfully', publishedQuiz));
    } catch (error) {
      console.error('Error publishing quiz:', error);
      return res.status(500).json(createResponse(false, 'Failed to publish quiz', null));
    }
  },

  // Unpublish a quiz
  async unpublishQuiz(req, res) {
    try {
      const { id } = req.params;
      
      // Get quiz
      const quiz = await QuizModel.findById(id);
      if (!quiz) {
        return res.status(404).json(createResponse(false, 'Quiz not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(quiz.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to unpublish this quiz
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to unpublish this quiz', null));
      }

      // Unpublish quiz
      const unpublishedQuiz = await QuizModel.unpublish(id);

      return res.status(200).json(createResponse(true, 'Quiz unpublished successfully', unpublishedQuiz));
    } catch (error) {
      console.error('Error unpublishing quiz:', error);
      return res.status(500).json(createResponse(false, 'Failed to unpublish quiz', null));
    }
  }
};

export default quizController;