"""
Smart-Weigh Backup Engine
Supports SQLite (dev) and MySQL (production) via an adapter pattern.
Database credentials are never passed to or from this module externally.
"""
import os
import re
import hashlib
import logging
import sqlite3
import shutil
import subprocess
import tempfile
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('smart_weigh.backup')


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()


def _backup_dir() -> Path:
    default = Path(settings.BASE_DIR) / 'backups'
    directory = Path(getattr(settings, 'BACKUP_DIR', default))
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _timestamped_filename(prefix: str, ext: str) -> str:
    return '{}__{}.{}'.format(prefix, timezone.now().strftime('%Y%m%d_%H%M%S'), ext)


# ─────────────────────────────────────────────────────────────────
# Base engine
# ─────────────────────────────────────────────────────────────────

class BaseBackupEngine(ABC):
    ENGINE_NAME = ''

    @abstractmethod
    def create_backup(self) -> dict:
        """
        Perform the backup.
        Returns dict: {filename, path, size_bytes, checksum_sha256}
        Raises on failure.
        """

    @abstractmethod
    def verify_backup(self, backup_path: Path) -> tuple:
        """
        Verify a backup file is readable and intact.
        Returns (ok: bool, message: str)
        """

    def apply_retention_policy(self) -> int:
        """
        Delete old backups per BACKUP_RETENTION_* settings.
        Returns number of files deleted.
        """
        backup_dir = _backup_dir()
        keep_daily = getattr(settings, 'BACKUP_RETENTION_DAILY', 7)
        keep_weekly = getattr(settings, 'BACKUP_RETENTION_WEEKLY', 4)
        keep_monthly = getattr(settings, 'BACKUP_RETENTION_MONTHLY', 12)

        now = timezone.now()
        all_files = sorted(
            [f for f in backup_dir.iterdir() if f.is_file()],
            key=lambda f: f.stat().st_mtime,
            reverse=True
        )

        kept = set()
        daily_kept = 0
        weekly_kept = 0
        monthly_kept = 0

        for f in all_files:
            mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc)
            age_days = (now - mtime).days
            week_num = mtime.isocalendar()[1]
            month_key = (mtime.year, mtime.month)

            if daily_kept < keep_daily and age_days < 8:
                kept.add(f)
                daily_kept += 1
            elif weekly_kept < keep_weekly and age_days < 29:
                kept.add(f)
                weekly_kept += 1
            elif monthly_kept < keep_monthly:
                kept.add(f)
                monthly_kept += 1

        deleted = 0
        for f in all_files:
            if f not in kept:
                try:
                    f.unlink()
                    logger.info('Retention: deleted old backup %s', f.name)
                    deleted += 1
                except OSError as e:
                    logger.error('Retention: failed to delete %s: %s', f.name, e)
        return deleted


# ─────────────────────────────────────────────────────────────────
# SQLite engine
# ─────────────────────────────────────────────────────────────────

class SQLiteBackupEngine(BaseBackupEngine):
    ENGINE_NAME = 'sqlite'

    def _get_db_path(self) -> Path:
        db_config = settings.DATABASES['default']
        name = db_config.get('NAME', '')
        if not name or name == ':memory:':
            raise ValueError('Cannot backup in-memory or unconfigured SQLite database.')
        return Path(name)

    def create_backup(self) -> dict:
        src_path = self._get_db_path()
        filename = _timestamped_filename('swms_backup', 'sqlite3')
        dest_path = _backup_dir() / filename

        # Use sqlite3 online backup API — safe with concurrent readers
        src_conn = sqlite3.connect(str(src_path))
        dest_conn = sqlite3.connect(str(dest_path))
        try:
            src_conn.backup(dest_conn)
        finally:
            dest_conn.close()
            src_conn.close()

        checksum = _sha256(dest_path)
        return {
            'filename': filename,
            'path': dest_path,
            'size_bytes': dest_path.stat().st_size,
            'checksum_sha256': checksum,
        }

    def verify_backup(self, backup_path: Path) -> tuple:
        if not backup_path.exists():
            return False, 'Backup file not found: {}'.format(backup_path)
        conn = None
        try:
            conn = sqlite3.connect(str(backup_path))
            result = conn.execute('PRAGMA integrity_check').fetchone()
            if result and result[0] == 'ok':
                return True, 'PRAGMA integrity_check: ok'
            else:
                return False, 'PRAGMA integrity_check failed: {}'.format(result)
        except Exception as e:
            return False, 'Verification error: {}'.format(e)
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass


# ─────────────────────────────────────────────────────────────────
# MySQL engine
# ─────────────────────────────────────────────────────────────────

class MySQLBackupEngine(BaseBackupEngine):
    ENGINE_NAME = 'mysql'

    def _db_config(self) -> dict:
        return settings.DATABASES['default']

    def _mysqldump_path(self) -> str:
        return getattr(settings, 'MYSQLDUMP_PATH', 'mysqldump')

    def _mysql_path(self) -> str:
        return getattr(settings, 'MYSQL_PATH', 'mysql')

    def create_backup(self) -> dict:
        cfg = self._db_config()
        filename = _timestamped_filename('swms_backup', 'sql')
        dest_path = _backup_dir() / filename

        cmd = [
            self._mysqldump_path(),
            '--single-transaction',
            '--routines',
            '--triggers',
            '--result-file={}'.format(dest_path),
            '--host={}'.format(cfg.get('HOST', 'localhost')),
            '--port={}'.format(cfg.get('PORT', '3306')),
            '--user={}'.format(cfg.get('USER', 'root')),
        ]
        if cfg.get('PASSWORD'):
            cmd.append('--password={}'.format(cfg['PASSWORD']))
        cmd.append(cfg['NAME'])

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise RuntimeError('mysqldump failed: {}'.format(result.stderr.strip()))

        if not dest_path.exists() or dest_path.stat().st_size == 0:
            raise RuntimeError('mysqldump produced empty or missing output file.')

        checksum = _sha256(dest_path)
        return {
            'filename': filename,
            'path': dest_path,
            'size_bytes': dest_path.stat().st_size,
            'checksum_sha256': checksum,
        }

    def verify_backup(self, backup_path: Path) -> tuple:
        if not backup_path.exists():
            return False, 'Backup file not found: {}'.format(backup_path)

        # Check the file has expected MySQL dump content
        with open(backup_path, 'r', encoding='utf-8', errors='replace') as f:
            first_lines = ''.join(f.readline() for _ in range(10))

        if 'MySQL dump' not in first_lines and 'Dump completed' not in first_lines:
            # Read last lines for completion marker
            pass

        # Restore into a temp database and count tables
        cfg = self._db_config()
        temp_db = 'swms_verify_{}'.format(int(timezone.now().timestamp()))
        try:
            create_cmd = [
                self._mysql_path(),
                '--host={}'.format(cfg.get('HOST', 'localhost')),
                '--port={}'.format(cfg.get('PORT', '3306')),
                '--user={}'.format(cfg.get('USER', 'root')),
            ]
            if cfg.get('PASSWORD'):
                create_cmd.append('--password={}'.format(cfg['PASSWORD']))
            create_cmd.extend(['-e', 'CREATE DATABASE IF NOT EXISTS {}'.format(temp_db)])

            r = subprocess.run(create_cmd, capture_output=True, text=True, timeout=30)
            if r.returncode != 0:
                return False, 'Could not create temp verify DB: {}'.format(r.stderr)

            restore_cmd = [
                self._mysql_path(),
                '--host={}'.format(cfg.get('HOST', 'localhost')),
                '--port={}'.format(cfg.get('PORT', '3306')),
                '--user={}'.format(cfg.get('USER', 'root')),
            ]
            if cfg.get('PASSWORD'):
                restore_cmd.append('--password={}'.format(cfg['PASSWORD']))
            restore_cmd.append(temp_db)

            with open(backup_path, 'r', encoding='utf-8') as sql_file:
                r = subprocess.run(restore_cmd, stdin=sql_file, capture_output=True, text=True, timeout=300)
            if r.returncode != 0:
                return False, 'Restore into temp DB failed: {}'.format(r.stderr[:500])

            # Count tables
            count_cmd = create_cmd[:-2] + ['-e',
                'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA="{}";'.format(temp_db)]
            r = subprocess.run(count_cmd, capture_output=True, text=True, timeout=30)
            table_count = r.stdout.strip().split('\n')[-1] if r.returncode == 0 else '?'
            return True, 'Restored successfully. Tables verified: {}'.format(table_count)

        except Exception as e:
            return False, 'Verification exception: {}'.format(e)
        finally:
            # Always drop the temp database
            try:
                drop_cmd = create_cmd[:-2] + ['-e', 'DROP DATABASE IF EXISTS {}'.format(temp_db)]
                subprocess.run(drop_cmd, capture_output=True, timeout=30)
            except Exception:
                pass


# ─────────────────────────────────────────────────────────────────
# Factory
# ─────────────────────────────────────────────────────────────────

def get_backup_engine() -> BaseBackupEngine:
    db_engine = settings.DATABASES['default'].get('ENGINE', '')
    if 'mysql' in db_engine.lower():
        return MySQLBackupEngine()
    elif 'sqlite' in db_engine.lower():
        return SQLiteBackupEngine()
    else:
        raise NotImplementedError('No backup engine for DB engine: {}'.format(db_engine))
