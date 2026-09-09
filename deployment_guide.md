# Smart-Weigh Production Deployment Guide

This document outlines the standard operating procedure for deploying the Smart-Weigh Management System to a production environment.

## 1. Prerequisites

Ensure the target production server has the following installed:
- **MySQL Server 8.0+**
- **Python 3.10+**
- **Node.js 20+**
- **Rust (for Tauri compilation)**
- **Nginx** (for serving the backend API securely)

## 2. Database Initialization

1. Log into your production MySQL server as root:
   ```bash
   mysql -u root -p
   ```
2. Run the initialization script to create the database, user, and apply privileges:
   ```bash
   source backend/scripts/mysql_init.sql
   ```
3. Update `your-db-password` in the script before running it.

## 3. Backend Deployment (Django)

1. **Virtual Environment:**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Environment Variables:**
   Copy the production template:
   ```bash
   cp .env.production.example .env
   ```
   **CRITICAL:** Update `SECRET_KEY`, `DATABASE_URL`, and `ALLOWED_HOSTS` in `.env`. Set `SECURE_PROTOCOLS=True`.

3. **Migrations:**
   Apply database migrations safely:
   ```bash
   python manage.py migrate
   ```

4. **Static Files:**
   Collect static files for the Django admin:
   ```bash
   python manage.py collectstatic --noinput
   ```

5. **Start Application:**
   Run the application using a production WSGI server (e.g., Gunicorn on Linux, Waitress on Windows).
   ```bash
   gunicorn smart_weigh.wsgi:application --bind 127.0.0.1:8000
   ```

## 4. Frontend & Desktop App Compilation

1. **Environment Variables:**
   Create `.env.production` in the `frontend` directory:
   ```bash
   cd frontend
   echo "NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1" > .env.production
   ```

2. **Build the Desktop Executable:**
   Compile the Next.js static site and package it into a Tauri desktop application:
   ```bash
   npm install
   npm run tauri build
   ```
   The optimized production installer will be located in `src-tauri/target/release/bundle/`.

## 5. Backup & Disaster Recovery

The system includes a built-in automated backup engine. 

### Scheduling Backups
Configure a scheduled task (cron on Linux, Task Scheduler on Windows) to run daily:
```bash
python manage.py backup_database
```
This will automatically verify the backup and prune old backups according to retention policies.

### Rollback Procedure
If a database migration fails or the system becomes corrupted, you can restore from the last verified backup:
```bash
python manage.py restore_backup --latest --confirm
```
*Note: This operation is destructive and replaces the current database with the backup.*

## 6. Error Monitoring & Logging

- **Logging:** Application logs are automatically written to `backend/logs/smart_weigh.log` and `django.log` when `DEBUG=False`. The logs rotate automatically at 15MB.
- **Monitoring:** It is strongly recommended to integrate a monitoring solution such as **Sentry** to capture unhandled exceptions in both the Django backend and the React frontend.
