from django.db import models
from django.conf import settings

class AuditLog(models.Model):
    ACTION_CHOICES = (
        ('CREATE', 'CREATE'),
        ('UPDATE', 'UPDATE'),
        ('DELETE', 'DELETE'),
        ('CORRECT', 'CORRECT'),
        ('REVERSE', 'REVERSE'),
        ('CANCEL', 'CANCEL'),
        ('APPROVE', 'APPROVE'),
        ('COMPLETE', 'COMPLETE'),
        ('LOGIN', 'LOGIN'),
        ('LOGOUT', 'LOGOUT'),
        ('LOGIN_FAILED', 'LOGIN_FAILED'),
        ('TICKET_GENERATE', 'TICKET_GENERATE'),
        ('TICKET_REPRINT', 'TICKET_REPRINT'),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)
    record_type = models.CharField(max_length=100, db_index=True)
    record_id = models.CharField(max_length=50, db_index=True)
    previous_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    reason = models.TextField(null=True, blank=True)
    action_datetime = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            # For audit viewer: filter by user+action, ordered by datetime
            models.Index(fields=['user', 'action'], name='audit_user_action_idx'),
            # For audit viewer: filter by record_type + record_id (transaction lifecycle view)
            models.Index(fields=['record_type', 'record_id'], name='audit_record_idx'),
        ]

    def __str__(self):
        return f"{self.action} on {self.record_type} #{self.record_id} by {self.user}"
