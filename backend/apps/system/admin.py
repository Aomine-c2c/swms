from django.contrib import admin
from apps.system.models import BackupLog


@admin.register(BackupLog)
class BackupLogAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'started_at', 'status', 'engine', 'triggered_by',
        'triggered_by_user', 'file_size_mb', 'verification_status',
    ]
    list_filter = ['status', 'engine', 'triggered_by']
    readonly_fields = [f.name for f in BackupLog._meta.get_fields() if hasattr(f, 'name')]
    ordering = ['-started_at']
    search_fields = ['backup_filename', 'error_message']

    def file_size_mb(self, obj):
        if obj.file_size_bytes:
            return '{:.2f} MB'.format(obj.file_size_bytes / 1024 / 1024)
        return '-'
    file_size_mb.short_description = 'Size'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
