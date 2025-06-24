import { query } from '../config/db.js';

// Get instructor analytics
export const getAnalytics = async (req, res) => {
  const instructorId = req.user.id;
  
  let coursesResult, studentsResult, revenueResult, completionResult;
  
  try {

    /* ───────── basic counts ───────── */
    coursesResult = await query(
      `SELECT COUNT(*) AS total_courses
         FROM courses
        WHERE instructor_id = $1`,
      [instructorId]
    );

    studentsResult = await query(
      `SELECT COUNT(DISTINCT e.user_id) AS total_students
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
        WHERE c.instructor_id = $1`,
      [instructorId]
    );

    revenueResult = await query(
      `SELECT 0 AS total_revenue`,
      []
    );

    /* ───────── completion rate (fixed path) ───────── */
    completionResult = await query(
      `SELECT
         COUNT(CASE WHEN p.status = 'completed' THEN 1 END) AS completed,
         COUNT(*)                                         AS total
         FROM lesson_progress p
         JOIN lessons  l ON l.id = p.lesson_id
         JOIN modules  m ON m.id = l.module_id
         JOIN courses  c ON c.id = m.course_id
        WHERE c.instructor_id = $1`,
      [instructorId]
    );

    const { completed, total } = completionResult.rows[0] || { completed: 0, total: 0 };
    const completionRate = total > 0 ? (completed / total * 100).toFixed(1) : 0;

    /* ───────── response ───────── */
    return res.json({
      success: true,
      data: {
        totalCourses:  Number(coursesResult.rows[0]?.total_courses || 0),
        totalStudents: Number(studentsResult.rows[0]?.total_students || 0),
        totalRevenue:  Number(revenueResult.rows[0]?.total_revenue || 0),
        completionRate: Number(completionRate)
      }
    });

  } catch (error) {
    console.error('Get instructor analytics error:', error);
    console.error('Error stack:', error.stack);
    console.error('Instructor ID:', instructorId);
    console.error('coursesResult:', coursesResult?.rows);
    console.error('studentsResult:', studentsResult?.rows);
    console.error('revenueResult:', revenueResult?.rows);
    console.error('completionResult:', completionResult?.rows);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch analytics' });
  }
};

// Get instructor activity feed
export const getActivity = async (req, res) => {
  const instructorId = req.user.id;

  try {
    const result = await query(
      `SELECT u.name, c.title, e.enrolled_at 
       FROM enrollments e 
       JOIN users u ON e.user_id = u.id 
       JOIN courses c ON e.course_id = c.id 
       WHERE c.instructor_id = $1`, 
      [instructorId]
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Get instructor activity error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch instructor activity." });
  }
};

// Get instructor tasks/pending items
export const getTasks = async (req, res) => {
  if (!req.user || !req.user.id) {
    console.error("Unauthorized request: Missing user id");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const instructorId = req.user.id;

    // Get ungraded assignment submissions
    const ungradedSubmissions = await query(
      `SELECT 
         s.id,
         'grade_submission' as type,
         a.title as assignment_title,
         c.title as course_title,
         u.name as student_name,
         s.submitted_at as submitted_at
       FROM submissions s
       JOIN assignments a ON s.assignment_id = a.id
       JOIN lessons l ON a.lesson_id = l.id
       JOIN modules m ON l.module_id = m.id
       JOIN courses c ON m.course_id = c.id
       JOIN users u ON s.user_id = u.id
       WHERE c.instructor_id = $1 AND s.grade IS NULL
       ORDER BY s.submitted_at ASC`,
      [instructorId]
    );

    // Get unpublished courses
    const unpublishedCourses = await query(
      `SELECT 
         id,
         'publish_course' as type,
         title as course_title,
         created_at
       FROM courses
       WHERE instructor_id = $1 AND is_published = false
       ORDER BY created_at ASC`,
      [instructorId]
    );

    // Get courses with incomplete content (no lessons)
    const incompleteCourses = await query(
      `SELECT 
         c.id,
         'add_content' as type,
         c.title as course_title,
         c.created_at
       FROM courses c
       LEFT JOIN modules m ON c.id = m.course_id
       LEFT JOIN lessons l ON m.id = l.module_id
       WHERE c.instructor_id = $1 AND l.id IS NULL
       ORDER BY c.created_at ASC`,
      [instructorId]
    );

    const tasks = {
      ungradedSubmissions: ungradedSubmissions.rows,
      unpublishedCourses: unpublishedCourses.rows,
      incompleteCourses: incompleteCourses.rows
    };

    res.json(tasks);
  } catch (error) {
    console.error('Get instructor tasks error stack:', error.stack || error);
    res.status(500).json({ error: error.message || 'Failed to fetch tasks' });
  }
};
