from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import HasPermission
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

class AuditLogFilter(django_filters.FilterSet):
    start_date = django_filters.DateTimeFilter(field_name="action_datetime", lookup_expr='gte')
    end_date = django_filters.DateTimeFilter(field_name="action_datetime", lookup_expr='lte')
    user = django_filters.NumberFilter(field_name="user__id")
    
    class Meta:
        model = AuditLog
        fields = ['action', 'record_type', 'record_id', 'user', 'start_date', 'end_date']

class AuditLogViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = AuditLog.objects.all().select_related('user').order_by('-action_datetime')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, HasPermission('view_audit_logs')] 
    filter_backends = [DjangoFilterBackend]
    filterset_class = AuditLogFilter
