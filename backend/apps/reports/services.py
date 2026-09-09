from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Q
from apps.weighing.models import WeighingTransaction
from apps.audit.models import AuditLog

class ReportService:
    @staticmethod
    def get_date_range(period, custom_start=None, custom_end=None):
        now = timezone.now()
        start_date = None
        end_date = now

        if period == 'daily':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == 'weekly':
            start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == 'monthly':
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == 'custom':
            if custom_start:
                start_date = custom_start
            if custom_end:
                end_date = custom_end
                
        return start_date, end_date

    @staticmethod
    def get_tonnage_report(period, group_by='material', custom_start=None, custom_end=None):
        start_date, end_date = ReportService.get_date_range(period, custom_start, custom_end)
        
        qs = WeighingTransaction.objects.filter(status__in=['Completed', 'Corrected'])
        if start_date:
            qs = qs.filter(first_weighing_datetime__gte=start_date)
        if end_date:
            qs = qs.filter(first_weighing_datetime__lte=end_date)
            
        group_field = ''
        if group_by == 'material':
            group_field = 'material__name'
        elif group_by == 'supplier':
            group_field = 'supplier__name'
        elif group_by == 'vehicle':
            group_field = 'vehicle__license_plate'
        else:
            group_field = 'material__name'
            
        data = qs.values(group_field).annotate(
            total_net_weight=Sum('net_weight'),
            transaction_count=Count('id')
        ).order_by('-total_net_weight')
        
        return list(data), group_field

    @staticmethod
    def get_status_report(period, custom_start=None, custom_end=None):
        start_date, end_date = ReportService.get_date_range(period, custom_start, custom_end)
        
        qs = WeighingTransaction.objects.all()
        if start_date:
            qs = qs.filter(created_at__gte=start_date)
        if end_date:
            qs = qs.filter(created_at__lte=end_date)
            
        data = qs.values('status').annotate(
            count=Count('id')
        ).order_by('-count')
        
        return list(data)

    @staticmethod
    def get_activity_report(period, custom_start=None, custom_end=None):
        start_date, end_date = ReportService.get_date_range(period, custom_start, custom_end)
        
        qs = AuditLog.objects.all()
        if start_date:
            qs = qs.filter(action_datetime__gte=start_date)
        if end_date:
            qs = qs.filter(action_datetime__lte=end_date)
            
        data = qs.values('user__username', 'action').annotate(
            count=Count('id')
        ).order_by('user__username', '-count')
        
        return list(data)
