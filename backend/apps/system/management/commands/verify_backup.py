"""
Management command: verify_backup

Usage:
  python manage.py verify_backup <log_id>
  python manage.py verify_backup --latest
"""
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from apps.system.backup.engine import get_backup_engine
from apps.system.models import BackupLog


class Command(BaseCommand):
    help = 'Verify the integrity of a backup file.'

    def add_arguments(self, parser):
        parser.add_argument('log_id', nargs='?', type=int, help='BackupLog ID to verify.')
        parser.add_argument('--latest', action='store_true', help='Verify the most recent successful backup.')

    def handle(self, *args, **options):
        if options['latest']:
            log = BackupLog.objects.filter(
                status__in=['SUCCESS', 'VERIFIED', 'VERIFY_FAILED']
            ).first()
            if not log:
                raise CommandError('No backup found to verify.')
        elif options['log_id']:
            try:
                log = BackupLog.objects.get(id=options['log_id'])
            except BackupLog.DoesNotExist:
                raise CommandError('BackupLog ID {} not found.'.format(options['log_id']))
        else:
            raise CommandError('Provide a log_id or use --latest.')

        if not log.backup_filename:
            raise CommandError('BackupLog {} has no associated file.'.format(log.id))

        from django.conf import settings
        from pathlib import Path
        backup_path = Path(getattr(settings, 'BACKUP_DIR', Path(settings.BASE_DIR) / 'backups')) / log.backup_filename

        self.stdout.write('Verifying: {}'.format(log.backup_filename))
        engine = get_backup_engine()
        ok, message = engine.verify_backup(backup_path)

        if ok:
            log.mark_verified(message)
            self.stdout.write(self.style.SUCCESS('PASSED: {}'.format(message)))
        else:
            log.mark_verify_failed(message)
            self.stderr.write(self.style.ERROR('FAILED: {}'.format(message)))
            raise SystemExit(1)
