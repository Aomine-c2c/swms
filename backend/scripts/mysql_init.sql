-- Smart-Weigh MySQL Production Initialization Script
-- Run this as MySQL root user: mysql -u root -p < mysql_init.sql

-- Create the production database with UTF-8 encoding
CREATE DATABASE IF NOT EXISTS smart_weigh
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Create the dedicated production user (Change 'your-db-password' before running!)
CREATE USER IF NOT EXISTS 'smartweigh_user'@'localhost' IDENTIFIED BY 'your-db-password';

-- Grant required privileges to the application user
GRANT ALL PRIVILEGES ON smart_weigh.* TO 'smartweigh_user'@'localhost';
GRANT FILE ON *.* TO 'smartweigh_user'@'localhost'; -- Required if using SELECT ... INTO OUTFILE for reports (optional)

-- Apply privilege changes
FLUSH PRIVILEGES;

-- IMPORTANT: For the backup engine (mysqldump) to work automatically, 
-- you may need to grant RELOAD, PROCESS, LOCK TABLES, REPLICATION CLIENT privileges 
-- globally to the backup user, OR run the backup script as a read-only admin user.
GRANT PROCESS, LOCK TABLES ON *.* TO 'smartweigh_user'@'localhost';
FLUSH PRIVILEGES;
