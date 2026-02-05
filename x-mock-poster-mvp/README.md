# Mock X Auto-Poster MVP - Setup Instructions

## 📋 Prerequisites

Before you begin, make sure you have:
- **Node.js** installed (download from [nodejs.org](https://nodejs.org/) - it's free!)
- A **text editor** (VS Code, Notepad++, or any editor)
- A **web browser** (Chrome, Firefox, Edge, etc.)
- A **terminal/command prompt**

---

## 🚀 Quick Start Guide

### Step 1: Navigate to the Project Folder

Open your terminal (Command Prompt or PowerShell on Windows) and navigate to the project:

```bash
cd e:\xfeature\x-mock-poster-mvp
```

### Step 2: Install Dependencies

The project only needs one dependency: Express. Install it with:

```bash
npm install
```

You should see output showing that Express and its dependencies were installed (about 68 packages).

### Step 3: Start the Server

Run the server with:

```bash
node server.js
```

or use the npm script:

```bash
npm start
```

You should see output like this:

```
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀
✅  Server is running!
📡  Open your browser and go to: http://localhost:3000
🎓  This is a mock/demo app - no real X API calls are made!
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀
```

### Step 4: Open in Browser

1. Open your web browser
2. Go to: `http://localhost:3000`
3. You should see a beautiful purple gradient page with the title **"Legal Case Auto-Poster Mock Demo"**

### Step 5: Test the Countdown

1. Click the **"🚀 Start Countdown"** button
2. Watch the timer count down from **10 seconds** to **0**
3. When it reaches 0, the app will "post" (mock only!)
4. You'll see a success message with:
   - Mock Post ID (e.g., `mock-1738729221123`)
   - Timestamp
   - The message that was "posted"

### Step 6: Check Server Console

Look at your terminal where the server is running. You should see a nicely formatted box showing the mock post details:

```
============================================================
📮  MOCK POST TO X (SIMULATED)
============================================================
Post ID:   mock-1738729221123
Timestamp: 2026-02-05T04:20:21.123Z
Message:   Legal Case Details: Verified case XYZ is being delayed by the court. Trial must start soon! #JusticeDelayed #PublicSupport
============================================================
```

---

## 🛑 Stopping the Server

To stop the server, press `Ctrl+C` in the terminal where it's running.

---

## 🔧 Troubleshooting

### Port Already in Use Error

If you see an error like `EADDRINUSE: address already in use :::3000`, it means port 3000 is being used by another program.

**Solution:** Edit `server.js` and change the port:

```javascript
const PORT = 3001;  // or any other number like 3002, 8080, etc.
```

Then restart the server and go to `http://localhost:3001` in your browser.

### Module Not Found Error

If you see `Cannot find module 'express'`, the dependencies weren't installed properly.

**Solution:** Run `npm install` again in the project folder.

### Page Won't Load

1. Make sure the server is running (check if you can see the rocket emojis in the terminal)
2. Make sure you're using the correct URL: `http://localhost:3000`
3. Try a different browser

---

## 📁 Project Structure

```
x-mock-poster-mvp/
├── server.js              # Main Express server (backend)
├── package.json           # Project metadata and dependencies
├── node_modules/          # Installed npm packages (created after npm install)
└── public/
    └── index.html         # Frontend UI (HTML, CSS, JavaScript)
```

---

## 🎓 Learning Notes

### What This Project Teaches:

1. **Backend Development:**
   - Setting up an Express.js server
   - Creating API endpoints (POST request)
   - Serving static files
   - Handling JSON requests/responses

2. **Frontend Development:**
   - HTML structure
   - CSS styling (gradients, animations, responsive design)
   - JavaScript DOM manipulation
   - Fetch API for making HTTP requests
   - Async/await syntax
   - Error handling

3. **Full-Stack Integration:**
   - How frontend and backend communicate
   - Client-server architecture
   - RESTful API design basics

### Key Concepts:

- **Mock API:** Simulates external API calls without actually making them
- **Zero-cost:** No external services, APIs, or paid features required
- **Local development:** Everything runs on your computer
- **Educational:** Heavily commented code to help you learn

---

## ✏️ Customization Ideas

Once you understand how it works, try these modifications:

1. **Change the countdown duration:** Edit the `let secondsLeft = 10;` line in `index.html`
2. **Customize the message:** Modify the `MESSAGE_TO_POST` variable in `index.html`
3. **Change colors:** Update the CSS gradient colors in the `<style>` section
4. **Add more features:**
   - Multiple message templates
   - Schedule multiple posts
   - History of previous "posts"
   - Export mock posts to a JSON file

---

## 🎯 Next Steps

After mastering this project:

1. Learn about real API integration (when you're ready to work with actual APIs)
2. Explore databases (like MongoDB or SQLite) to store post history
3. Learn React or Vue.js for more complex frontends
4. Deploy to a free hosting service (like Vercel, Netlify, or Railway)

---

## ❓ FAQ

**Q: Does this actually post to X (Twitter)?**  
A: No! This is a mock/demo only. No real API calls are made. Everything is simulated.

**Q: Do I need an X/Twitter account?**  
A: No! The app simulates posting without connecting to any real service.

**Q: Is this free?**  
A: Yes! 100% free. No API keys, no subscriptions, no external services.

**Q: Can I share this project?**  
A: Absolutely! It's a great learning tool for students.

---

**Happy coding! 🚀**
