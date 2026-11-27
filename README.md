# Peopleflow

A people-first employee management app built with React, Vite, a Node.js API, and MongoDB. It includes account registration, sign-in, password reset, and an employee dashboard with create, edit, delete, search, department filters, and team summaries.

## Run locally

Install and start MongoDB locally, then create or update `backend/.env` using `backend/.env.example` as a template. Set `MONGODB_URI` to your MongoDB connection string and `MONGODB_DB` to the database name. The API creates the required indexes when it starts. This starts with fresh MongoDB collections; existing MySQL data is left untouched and is not imported.

Use two terminals from the project directory:

1. Start the API: `npm run server`
2. Start the frontend: `npm run dev`
3. Open the Vite URL printed in the second terminal.

The Vite development server proxies `/api` requests to the Node API on port `3001`. Set `API_PORT` to use a different backend port and update the proxy in `frontend/vite.config.js` to match.

### Demo account

In development, the API creates a demo account and a sample team the first time it starts:

- Email: `demo@peopleflow.com`
- Password: `Demo123!`

New sign-ups create an empty team workspace. Accounts, employees, password reset tokens, and sessions are stored in MongoDB. MongoDB ObjectIds are returned as string IDs to the frontend.

### Password reset

The API generates single-use reset codes that expire after 15 minutes. Because this starter does not include an email delivery provider, the reset code is shown in the app only in development. Before deploying, connect the forgot-password endpoint to a trusted email provider; production responses intentionally do not disclose reset codes.

## Deploy to Vercel

Set the Vercel project root to the repository root. Vite builds the frontend into the root `dist` directory to match Vercel's output setting in `vercel.json`, which also routes `/api/*` requests to the Node.js function in `api/index.js`. The API stores login sessions in MongoDB so they work across serverless instances.

Add `MONGODB_URI` and `MONGODB_DB` as Vercel environment variables. Use a MongoDB deployment reachable from Vercel; `localhost` and `127.0.0.1` refer to the function itself, not your computer. Do not put production credentials in `backend/.env.example` or commit them.

### Checks

- `npm run lint`
- `npm run build`

## Project layout

- `frontend/src/components/` — authentication, dashboard, employee form, icons, and display helpers
- `frontend/src/lib/api.js` — shared frontend API client
- `backend/index.js` — Node.js auth and employee CRUD API
- `backend/database.js` — MongoDB client connection and index initialization
- `backend/.env.example` — MongoDB connection settings template
