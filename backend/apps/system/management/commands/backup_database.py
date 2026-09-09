"""
Management command: backup_database

Usage:
  python manage.py backup_database
  python manage.py backup_database --skip-verify
  python manage.py backup_database --trigger scheduled
"""
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.system.backup.engine import get_backup_engine
from apps.system.models import BackupLog

logger = logging.getLogger('smart_weigh.backup')


class Command(BaseCommand):
    help = 'Create, verify, and apply retention to a database backup.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-verify', action='store_true',
            help='Skip verification step (not recommended for production).'
        )
        parser.add_argument(
            '--trigger', choices=['SCHEDULED', 'MANUAL', 'PRE_MIGRATION'],
            default='MANUAL', help='How this backup was triggered.'
        )

    def handle(self, *args, **options):
        engine = get_backup_engine()
        skip_verify = options['skip_verify']
        trigger = options['trigger']

        self.stdout.write(self.style.NOTICE(
            '[{}] Starting {} backup...'.format(timezone.now().strftime('%H:%M:%S'), engine.ENGINE_NAME.upper())
        ))

        log = BackupLog.objects.create(
            engine=engine.ENGINE_NAME,
            triggered_by=trigger,
        )

        try:
            result = engine.create_backup()
            log.mark_success(
                filename=result['filename'],
                size_bytes=result['size_bytes'],
                checksum=result['checksum_sha256'],
            )
            self.stdout.write(self.style.SUCCESS(
                '  Backup created: {} ({:.1f} MB)'.format(
                    result['filename'], result['size_bytes'] / 1024 / 1024
                )
            ))
        except Exception as e:
            log.mark_failed(e)
            self.stderr.write(self.style.ERROR('  BACKUP FAILED: {}'.format(e)))
            logger.error('Backup failed: %s', e, exc_info=True)
            raise SystemExit(1)

        if not skip_verify:
            self.stdout.write(self.style.NOTICE('  Verifying backup...'))
            ok, message = engine.verify_backup(result['path'])
            if ok:
                log.mark_verified(message)
                self.stdout.write(self.style.SUCCESS('  Verification: PASSED - {}'.format(message)))
            else:
                log.mark_verify_failed(message)
                self.stderr.write(self.style.ERROR('  Verification: FAILED - {}'.format(message)))
                logger.error('Backup verification failed for %s: %s', result['filename'], message)
                raise SystemExit(1)

        # Retention policy
        self.stdout.write(self.style.NOTICE('  Applying retention policy...'))
        pruned = engine.apply_retention_policy()
        log.retention_policy_applied = True
        log.files_pruned = pruned
        log.save(update_fields=['retention_policy_applied', 'files_pruned'])
        if pruned:
            self.stdout.write(self.style.WARNING('  Pruned {} old backup(s).'.format(pruned)))

        self.stdout.write(self.style.SUCCESS(
            '[DONE] Backup log ID: {} | Status: {}'.format(log.id, log.status)
        ))
