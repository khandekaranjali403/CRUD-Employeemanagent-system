# Peopleflow

A people-first employee management app built with React, Vite, a Node.js API, and MySQL. It includes account registration, sign-in, password reset, and an employee dashboard with create, edit, delete, search, department filters, and team summaries.

## Run locally

Create the database named by `MYSQL_DATABASE` in `backend/.env` once. For the sample configuration:

```sql
CREATE DATABASE peopleflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy `backend/.env.example` to `backend/.env` and set your MySQL credentials. The API creates its tables from `backend/schema.sql` at startup.

Use two terminals from the project directory:

1. Start the API: `npm run server`
2. Start the frontend: `npm run dev`
3. Open the Vite URL printed in the second terminal.

The Vite development server proxies `/api` requests to the Node API on port `3001`. Set `API_PORT` to use a different backend port and update the proxy in `frontend/vite.config.js` to match.

### Demo account

In development, the API creates a demo account and a sample team the first time it starts:

- Email: `demo@peopleflow.com`
- Password: `Demo123!`

New sign-ups create an empty team workspace. Accounts, employees, and password reset tokens are stored in MySQL.

### Import existing JSON data

To migrate the existing `backend/data/store.json`, configure a fresh, empty MySQL database and run `npm run migrate:json` before starting the API. The migration is transactional and refuses to import into tables that already contain records. Keep a backup of the JSON file until you have verified the imported data.

### Password reset

The API generates single-use reset codes that expire after 15 minutes. Because this starter does not include an email delivery provider, the reset code is shown in the app only in development. Before deploying, connect the forgot-password endpoint to a trusted email provider; production responses intentionally do not disclose reset codes.

### Checks

- `npm run lint`
- `npm run build`

## Project layout

- `frontend/src/components/` — authentication, dashboard, employee form, icons, and display helpers
- `frontend/src/lib/api.js` — shared frontend API client
- `backend/index.js` — Node.js auth and employee CRUD API
- `backend/database.js` — MySQL connection pool and schema initialization
- `backend/schema.sql` — database tables and indexes
- `backend/.env.example` — MySQL connection settings template
- `backend/data/` — legacy JSON data for the one-time importer
