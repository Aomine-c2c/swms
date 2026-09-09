from rest_framework import serializers
from apps.system.models import BackupLog


class BackupLogSerializer(serializers.ModelSerializer):
    """
    Safe serializer: file system paths and DB credentials are NEVER included.
    Only metadata needed for the admin UI is exposed.
    """
    triggered_by_username = serializers.SerializerMethodField()
    file_size_mb = serializers.SerializerMethodField()
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = BackupLog
        # Explicitly list safe fields -- backup_filename and path are intentionally excluded
        fields = [
            'id',
            'started_at',
            'completed_at',
            'status',
            'engine',
            'triggered_by',
            'triggered_by_username',
            'file_size_bytes',
            'file_size_mb',
            'checksum_sha256',
            'verification_status',
            'verification_message',
            'retention_policy_applied',
            'files_pruned',
            'error_message',
            'duration_seconds',
        ]
        read_only_fields = fields

    def get_triggered_by_username(self, obj):
        if obj.triggered_by_user:
            return obj.triggered_by_user.username
        return None

    def get_file_size_mb(self, obj):
        if obj.file_size_bytes:
            return round(obj.file_size_bytes / 1024 / 1024, 2)
        return None

    def get_duration_seconds(self, obj):
        if obj.started_at and obj.completed_at:
            return round((obj.completed_at - obj.started_at).total_seconds(), 1)
        return None


class BackupStatusSerializer(serializers.Serializer):
    last_successful_backup = BackupLogSerializer(allow_null=True)
    last_failed_backup = BackupLogSerializer(allow_null=True)
    currently_running = BackupLogSerializer(allow_null=True)
    total_backups = serializers.IntegerField()
    verified_backups = serializers.IntegerField()
    failed_backups = serializers.IntegerField()
