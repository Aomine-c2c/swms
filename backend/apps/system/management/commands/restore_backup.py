"""
Management command: restore_backup

DANGER: This overwrites the current database. Requires --confirm.

Usage:
  python manage.py restore_backup <log_id> --confirm
  python manage.py restore_backup --latest --confirm
  python manage.py restore_backup --file path/to/backup.sqlite3 --confirm
"""
import shutil
import sqlite3
import subprocess
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.system.backup.engine import get_backup_engine
from apps.system.models import BackupLog


class Command(BaseCommand):
    help = 'Restore a database from a backup. DESTRUCTIVE — requires --confirm.'

    def add_arguments(self, parser):
        parser.add_argument('log_id', nargs='?', type=int, help='BackupLog ID to restore from.')
        parser.add_argument('--latest', action='store_true', help='Restore the most recent verified backup.')
        parser.add_argument('--file', type=str, help='Explicit path to backup file.')
        parser.add_argument(
            '--confirm', action='store_true', required=True,
            help='REQUIRED: Confirms you understand this is a destructive operation.'
        )

    def handle(self, *args, **options):
        backup_dir = Path(getattr(settings, 'BACKUP_DIR', Path(settings.BASE_DIR) / 'backups'))

        if options['file']:
            backup_path = Path(options['file'])
        elif options['latest']:
            log = BackupLog.objects.filter(status__in=['VERIFIED', 'SUCCESS']).first()
            if not log:
                raise CommandError('No verified or successful backup found.')
            backup_path = backup_dir / log.backup_filename
        elif options['log_id']:
            try:
                log = BackupLog.objects.get(id=options['log_id'])
            except BackupLog.DoesNotExist:
                raise CommandError('BackupLog ID {} not found.'.format(options['log_id']))
            backup_path = backup_dir / log.backup_filename
        else:
            raise CommandError('Provide a log_id, --latest, or --file.')

        if not backup_path.exists():
            raise CommandError('Backup file not found: {}'.format(backup_path))

        self.stderr.write(self.style.WARNING(
            '\nWARNING: This will OVERWRITE the current database with: {}'.format(backup_path.name)
        ))

        db_engine = settings.DATABASES['default'].get('ENGINE', '')

        if 'sqlite' in db_engine.lower():
            self._restore_sqlite(backup_path)
        elif 'mysql' in db_engine.lower():
            self._restore_mysql(backup_path)
        else:
            raise CommandError('Unsupported DB engine for restore: {}'.format(db_engine))

        self.stdout.write(self.style.SUCCESS('Restore completed from: {}'.format(backup_path.name)))

    def _restore_sqlite(self, backup_path: Path):
        db_path = Path(settings.DATABASES['default']['NAME'])
        # Take a safety backup of current DB first
        safety_name = db_path.parent / 'pre_restore_{}.sqlite3'.format(
            timezone.now().strftime('%Y%m%d_%H%M%S')
        )
        shutil.copy2(str(db_path), str(safety_name))
        self.stdout.write('Safety backup of current DB: {}'.format(safety_name.name))

        # Verify source before overwriting
        try:
            conn = sqlite3.connect(str(backup_path))
            result = conn.execute('PRAGMA integrity_check').fetchone()
            conn.close()
            if not result or result[0] != 'ok':
                raise CommandError('Backup integrity check failed before restore. Aborting.')
        except Exception as e:
            raise CommandError('Cannot verify backup before restore: {}'.format(e))

        shutil.copy2(str(backup_path), str(db_path))
        self.stdout.write(self.style.SUCCESS('SQLite database restored successfully.'))

    def _restore_mysql(self, backup_path: Path):
        cfg = settings.DATABASES['default']
        mysql_path = getattr(settings, 'MYSQL_PATH', 'mysql')

        # Safety backup first
        engine = get_backup_engine()
        self.stdout.write('Creating safety backup of current state...')
        try:
            engine.create_backup()
        except Exception as e:
            self.stderr.write(self.style.WARNING('Safety backup failed: {}. Proceeding anyway.'.format(e)))

        cmd = [
            mysql_path,
            '--host={}'.format(cfg.get('HOST', 'localhost')),
            '--port={}'.format(cfg.get('PORT', '3306')),
            '--user={}'.format(cfg.get('USER', 'root')),
        ]
        if cfg.get('PASSWORD'):
            cmd.append('--password={}'.format(cfg['PASSWORD']))
        cmd.append(cfg['NAME'])

        with open(backup_path, 'r', encoding='utf-8') as sql_file:
            result = subprocess.run(cmd, stdin=sql_file, capture_output=True, text=True, timeout=600)

        if result.returncode != 0:
            raise CommandError('MySQL restore failed: {}'.format(result.stderr[:1000]))

        self.stdout.write(self.style.SUCCESS('MySQL database restored successfully.'))
