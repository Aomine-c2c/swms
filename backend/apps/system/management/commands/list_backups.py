"""
Management command: list_backups

Usage:
  python manage.py list_backups
  python manage.py list_backups --limit 10
"""
from django.core.management.base import BaseCommand
from apps.system.models import BackupLog


class Command(BaseCommand):
    help = 'List backup history.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=20, help='Number of records to show.')

    def handle(self, *args, **options):
        logs = BackupLog.objects.all()[:options['limit']]
        if not logs:
            self.stdout.write('No backup records found.')
            return

        header = '{:<6} {:<22} {:<14} {:<12} {:<10} {}'.format(
            'ID', 'Started', 'Status', 'Engine', 'Size MB', 'Triggered By'
        )
        self.stdout.write(header)
        self.stdout.write('-' * len(header))
        for log in logs:
            size = '{:.1f}'.format(log.file_size_bytes / 1024 / 1024) if log.file_size_bytes else '-'
            self.stdout.write('{:<6} {:<22} {:<14} {:<12} {:<10} {}'.format(
                log.id,
                log.started_at.strftime('%Y-%m-%d %H:%M:%S'),
                log.status,
                log.engine,
                size,
                log.triggered_by,
            ))

        last_verified = BackupLog.objects.filter(status='VERIFIED').first()
        if last_verified:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS(
                'Last verified backup: {} at {}'.format(
                    last_verified.backup_filename,
                    last_verified.started_at.strftime('%Y-%m-%d %H:%M:%S')
                )
            ))
