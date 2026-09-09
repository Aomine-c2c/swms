from apps.audit.models import AuditLog
from django.utils import timezone
import json

def log_audit_action(user, action, record_type, record_id, previous_value=None, new_value=None, reason=None):
    """
    Creates an AuditLog entry.
    """
    return AuditLog.objects.create(
        user=user,
        action=action,
        record_type=record_type,
        record_id=str(record_id),
        previous_value=previous_value,
        new_value=new_value,
        reason=reason,
        action_datetime=timezone.now()
    )
