"""
System API views — backup status and management.
IMPORTANT: No file paths or database credentials are exposed in any response.
"""
import logging
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import HasPermission
from apps.system.backup.engine import get_backup_engine
from apps.system.models import BackupLog
from apps.system.serializers import BackupLogSerializer, BackupStatusSerializer

logger = logging.getLogger('smart_weigh.backup')


class BackupViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Backup administration endpoints.
    All responses omit file system paths and DB credentials.
    """
    serializer_class = BackupLogSerializer
    permission_classes = [IsAuthenticated, HasPermission('manage_system')]

    def get_queryset(self):
        return BackupLog.objects.all().order_by('-started_at')

    @action(detail=False, methods=['get'])
    def status(self, request):
        """
        Returns a quick summary of the backup system health:
        - last successful backup
        - last failed backup
        - current running backup (if any)
        - total backup count
        """
        last_verified = BackupLog.objects.filter(status__in=['VERIFIED', 'SUCCESS']).first()
        last_failed = BackupLog.objects.filter(status__in=['FAILED', 'VERIFY_FAILED']).first()
        running = BackupLog.objects.filter(status='RUNNING').first()

        summary = {
            'last_successful_backup': BackupLogSerializer(last_verified).data if last_verified else None,
            'last_failed_backup': BackupLogSerializer(last_failed).data if last_failed else None,
            'currently_running': BackupLogSerializer(running).data if running else None,
            'total_backups': BackupLog.objects.count(),
            'verified_backups': BackupLog.objects.filter(status='VERIFIED').count(),
            'failed_backups': BackupLog.objects.filter(status__in=['FAILED', 'VERIFY_FAILED']).count(),
        }
        return Response(summary)

    @action(detail=False, methods=['post'])
    def trigger(self, request):
        """
        Trigger a manual backup. Runs synchronously in this request.
        In production, consider moving to a background task queue.
        """
        # Check if a backup is already running
        if BackupLog.objects.filter(status='RUNNING').exists():
            return Response(
                {'error': 'A backup is already in progress.'},
                status=status.HTTP_409_CONFLICT
            )

        log = BackupLog.objects.create(
            engine='',  # Will be set by engine
            triggered_by='MANUAL',
            triggered_by_user=request.user,
        )

        try:
            engine = get_backup_engine()
            log.engine = engine.ENGINE_NAME
            log.save(update_fields=['engine'])

            result = engine.create_backup()
            log.mark_success(
                filename=result['filename'],
                size_bytes=result['size_bytes'],
                checksum=result['checksum_sha256'],
            )

            ok, message = engine.verify_backup(result['path'])
            if ok:
                log.mark_verified(message)
            else:
                log.mark_verify_failed(message)
                logger.error('Manual backup verification failed: %s', message)

            pruned = engine.apply_retention_policy()
            log.retention_policy_applied = True
            log.files_pruned = pruned
            log.save(update_fields=['retention_policy_applied', 'files_pruned'])

        except Exception as e:
            log.mark_failed(e)
            logger.error('Manual backup triggered by %s failed: %s', request.user, e, exc_info=True)
            return Response(
                {'error': 'Backup failed: {}'.format(str(e))},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(BackupLogSerializer(log).data, status=status.HTTP_201_CREATED)
