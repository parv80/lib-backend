// backend/routes/books.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Add a new book (admin)
router.post('/', async (req, res) => {
  const { code, title, author, total_copies } = req.body;
  if (!code || !title || !total_copies) return res.status(400).json({ error: 'Missing fields' });
  try {
    const conn = await pool.getConnection();
    await conn.query(
      'INSERT INTO books (code, title, author, total_copies, available_copies) VALUES (?, ?, ?, ?, ?)',
      [code, title, author || '', total_copies, total_copies]
    );
    conn.release();
    res.json({ success: true });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Book code already exists' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get all books
router.get('/', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM books ORDER BY title');
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get library summary: total books, available, issued
router.get('/summary', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [totRows] = await conn.query('SELECT IFNULL(SUM(total_copies),0) AS total_books, IFNULL(SUM(available_copies),0) AS available_books FROM books');
    const [issuedRows] = await conn.query('SELECT COUNT(*) AS issued FROM issues WHERE returned_date IS NULL');
    conn.release();
    res.json({
      total_books: totRows[0].total_books,
      available_books: totRows[0].available_books,
      issued: issuedRows[0].issued
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search books by title
router.get('/search', async (req, res) => {
  const q = req.query.q || '';
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM books WHERE title LIKE ? ORDER BY title', [`%${q}%`]);
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
