// ========================================
// SERVER.JS - Express Backend for Mock X Poster
// ========================================
// This file sets up a simple Node.js server using Express.
// It serves static files (HTML/CSS/JS) and provides an API endpoint
// to simulate posting to X (formerly Twitter).

// Import the Express framework
const express = require('express');
const app = express();

// Configuration: Port number where the server will run
const PORT = 3000;

// ========================================
// MIDDLEWARE SETUP
// ========================================

// Parse incoming JSON requests (so we can read req.body)
app.use(express.json());

// Serve static files from the 'public' folder
// This means files like index.html, styles.css, etc. in 'public' 
// will be accessible to the browser
app.use(express.static('public'));

// ========================================
// API ENDPOINTS
// ========================================

/**
 * POST /post-to-x
 * 
 * This endpoint simulates posting a message to X.
 * It doesn't make any real API calls - everything is mocked!
 * 
 * Expected request body:
 * {
 *   "message": "Your message text here"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "mockPostId": "mock-1234567890",
 *   "message": "Your message text",
 *   "timestamp": "2026-02-04T20:15:31.000Z"
 * }
 */
app.post('/post-to-x', (req, res) => {
  // Extract the message from the request body
  const { message } = req.body;

  // Validate that a message was provided
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'No message provided'
    });
  }

  // Generate a mock post ID using timestamp (makes it unique)
  const mockPostId = `mock-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // Log the mock post details to the server console in a nice boxed format
  console.log('\n' + '='.repeat(60));
  console.log('📮  MOCK POST TO X (SIMULATED)');
  console.log('='.repeat(60));
  console.log(`Post ID:   ${mockPostId}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Message:   ${message}`);
  console.log('='.repeat(60) + '\n');

  // Simulate a slight delay (like a real API call would have)
  setTimeout(() => {
    // Send success response back to the client
    res.json({
      success: true,
      mockPostId: mockPostId,
      message: message,
      timestamp: timestamp
    });
  }, 500); // 500ms delay to simulate network request
});

// ========================================
// START THE SERVER
// ========================================

app.listen(PORT, () => {
  console.log('\n' + '🚀'.repeat(30));
  console.log(`✅  Server is running!`);
  console.log(`📡  Open your browser and go to: http://localhost:${PORT}`);
  console.log(`🎓  This is a mock/demo app - no real X API calls are made!`);
  console.log('🚀'.repeat(30) + '\n');
});
