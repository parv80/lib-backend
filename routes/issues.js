// backend/routes/issues.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Issue a book (student action)
router.post('/issue', async (req, res) => {
  const { book_code, name, college, phone, due_date } = req.body;
  if (!book_code || !name || !phone || !due_date) return res.status(400).json({ error: 'Missing fields' });
  try {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    // Lock book row
    const [books] = await conn.query('SELECT * FROM books WHERE code = ? FOR UPDATE', [book_code]);
    if (!books.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Book not found' });
    }
    const book = books[0];
    if (book.available_copies < 1) {
      const [rows] = await conn.query('SELECT MIN(due_date) AS next_available FROM issues WHERE book_id = ? AND returned_date IS NULL', [book.id]);
      await conn.rollback();
      conn.release();
      return res.status(409).json({ error: 'Not available', next_available: rows[0].next_available });
    }

    // insert or find student
    const [students] = await conn.query('SELECT * FROM students WHERE phone = ?', [phone]);
    let studentId;
    if (students.length) {
      studentId = students[0].id;
      await conn.query('UPDATE students SET name = ?, college = ? WHERE id = ?', [name, college || '', studentId]);
    } else {
      const [result] = await conn.query('INSERT INTO students (name, college, phone) VALUES (?, ?, ?)', [name, college || '', phone]);
      studentId = result.insertId;
    }

    // create issue
    const issueDate = new Date().toISOString().slice(0, 10);
    await conn.query('INSERT INTO issues (book_id, student_id, issue_date, due_date) VALUES (?, ?, ?, ?)', [book.id, studentId, issueDate, due_date]);

    // decrement available copies
    await conn.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [book.id]);

    await conn.commit();
    conn.release();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Return a book using book_code + student name + phone
router.post('/return', async (req, res) => {
  const { book_code, name, phone } = req.body;
  if (!book_code || !name || !phone) return res.status(400).json({ error: 'Missing fields' });

  try {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    // Find the book
    const [books] = await conn.query('SELECT * FROM books WHERE code = ?', [book_code]);
    if (!books.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Book not found' });
    }
    const book = books[0];

    // Find the student
    const [students] = await conn.query('SELECT * FROM students WHERE phone = ? AND name = ?', [phone, name]);
    if (!students.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = students[0];

    // Find issue record (not returned)
    const [issues] = await conn.query(
      'SELECT * FROM issues WHERE book_id = ? AND student_id = ? AND returned_date IS NULL',
      [book.id, student.id]
    );
    if (!issues.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'No active issue found for this student & book' });
    }

    const issue = issues[0];
    const returnDate = new Date().toISOString().slice(0, 10);

    await conn.query('UPDATE issues SET returned_date = ? WHERE id = ?', [returnDate, issue.id]);
    await conn.query('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', [book.id]);

    await conn.commit();
    conn.release();
    res.json({ success: true, message: 'Book returned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: list current issued books (not returned)
router.get('/current', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT i.id AS issue_id, b.title, b.code, s.name, s.phone, s.college, i.issue_date, i.due_date
       FROM issues i
       JOIN books b ON i.book_id = b.id
       JOIN students s ON i.student_id = s.id
       WHERE i.returned_date IS NULL
       ORDER BY i.due_date`
    );
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
