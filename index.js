// backend/index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const booksRouter = require('./routes/books');
const issuesRouter = require('./routes/issues');

const app = express();

// ✅ Configure CORS for your deployed frontend
app.use(cors({
  origin: "https://lib-w2rm.onrender.com", 
  credentials: true,
}));

app.use(bodyParser.json());

// ------------------------
// Routes

// Root route
app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// API routes
app.use('/api/books', booksRouter);
app.use('/api/issues', issuesRouter);

// ------------------------
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
