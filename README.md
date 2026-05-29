# CodeSync Backend

This is the backend API and WebSocket server for CodeSync, a real-time collaborative code editor. It handles authentication, database operations, live collaboration sessions, and remote code execution.

## Tech Stack

* **Runtime:** [Node.js](https://nodejs.org/)
* **Framework:** [Express.js](https://expressjs.com/)
* **Database:** [MongoDB](https://www.mongodb.com/) (using Mongoose)
* **Real-time Communication:** [Socket.IO](https://socket.io/)
* **Authentication:** [Passport.js](https://www.passportjs.org/) (Google OAuth) & JWT
* **Security:** bcryptjs, CORS, HTTP-Only Cookies
* **Code Execution:** Integrated with Judge0 CE

## Features

* **RESTful API:** Endpoints for user management, projects, files, and admin operations.
* **WebSocket Server:** Real-time Operational Transformation (OT) or sync mechanisms to broadcast code changes, cursor positions, and chat messages to connected users.
* **Secure Authentication:** JWT-based authentication using HTTP-only cookies, hardened against XSS and configured securely for cross-domain deployments (`sameSite: 'none'`).
* **OAuth Integration:** Sign in with Google using Passport.js.
* **Code Sandbox:** Executes user code dynamically using the free Judge0 CE public API.
* **Automated Cron Jobs:** Cleans up stale sessions and inactive data in the background.

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* A [MongoDB](https://www.mongodb.com/atlas/database) database connection string.

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables. Create a `.env` file in the root of the backend directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRE=30d
   FRONTEND_URL=http://localhost:5173
   SESSION_SECRET=your_session_secret
   
   # OAuth Credentials
   GOOGLE_CLIENT_ID=your_google_id
   GOOGLE_CLIENT_SECRET=your_google_secret
   ```

3. Start the development server (uses `nodemon` for hot-reloading):
   ```bash
   npm run dev
   ```

4. The API will be available at `http://localhost:5000`.

## Deployment Instructions

When deploying to a platform like **Render** or **Heroku**:

1. Ensure all environment variables from `.env` are added to your hosting provider's dashboard.
2. If your frontend is hosted on a different domain (e.g., Vercel), ensure your `FRONTEND_URL` is set to your live frontend URL so CORS accepts the requests.
   * *Note: The backend automatically handles comma-separated URLs in the `FRONTEND_URL` variable if you need to support both localhost and production.*
3. The server automatically detects `NODE_ENV=production` and adjusts cookie security policies accordingly to allow cross-domain login sessions.
4. **Google OAuth Note:** Ensure you update your "Authorized redirect URIs" in the Google Cloud Console to point to your new live backend domain (e.g., `https://your-backend.onrender.com/api/auth/google/callback`).
