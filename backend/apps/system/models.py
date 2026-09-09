from django.db import models
from django.conf import settings


class BackupLog(models.Model):
    ENGINE_CHOICES = (
        ('sqlite', 'SQLite'),
        ('mysql', 'MySQL'),
    )
    STATUS_CHOICES = (
        ('RUNNING', 'Running'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('VERIFIED', 'Verified'),
        ('VERIFY_FAILED', 'Verification Failed'),
    )
    TRIGGER_CHOICES = (
        ('SCHEDULED', 'Scheduled'),
        ('MANUAL', 'Manual'),
        ('PRE_MIGRATION', 'Pre-Migration'),
    )

    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='RUNNING', db_index=True)
    engine = models.CharField(max_length=10, choices=ENGINE_CHOICES)
    triggered_by = models.CharField(max_length=20, choices=TRIGGER_CHOICES, default='MANUAL')
    triggered_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='backup_logs'
    )

    # File info -- NEVER served to the frontend
    backup_filename = models.CharField(max_length=255, blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True)

    # Verification
    verification_status = models.CharField(max_length=20, blank=True)
    verification_message = models.TextField(blank=True)

    # Retention
    retention_policy_applied = models.BooleanField(default=False)
    files_pruned = models.IntegerField(default=0)

    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['status', 'started_at'], name='backup_status_date_idx'),
        ]

    def __str__(self):
        return 'Backup [{}] started {}'.format(self.status, self.started_at)

    def mark_success(self, filename, size_bytes, checksum):
        from django.utils import timezone
        self.completed_at = timezone.now()
        self.status = 'SUCCESS'
        self.backup_filename = filename
        self.file_size_bytes = size_bytes
        self.checksum_sha256 = checksum
        self.save(update_fields=['completed_at', 'status', 'backup_filename', 'file_size_bytes', 'checksum_sha256'])

    def mark_failed(self, error):
        from django.utils import timezone
        self.completed_at = timezone.now()
        self.status = 'FAILED'
        self.error_message = str(error)
        self.save(update_fields=['completed_at', 'status', 'error_message'])

    def mark_verified(self, message='OK'):
        self.status = 'VERIFIED'
        self.verification_status = 'OK'
        self.verification_message = message
        self.save(update_fields=['status', 'verification_status', 'verification_message'])

    def mark_verify_failed(self, message):
        self.status = 'VERIFY_FAILED'
        self.verification_status = 'FAILED'
        self.verification_message = message
        self.save(update_fields=['status', 'verification_status', 'verification_message'])
