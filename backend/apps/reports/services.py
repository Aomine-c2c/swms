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

        # Overall summary KPIs for the filtered scope
        totals = qs.aggregate(
            total_tonnage=Sum('net_weight'),
            total_transactions=Count('id')
        )
        total_kg = totals['total_tonnage'] or 0
        total_count = totals['total_transactions'] or 0

        # Time-series trend for the filtered scope
        trend_qs = qs.values('first_weighing_datetime__date').annotate(
            tonnage=Sum('net_weight'),
            count=Count('id')
        ).order_by('first_weighing_datetime__date')

        summary = {
            'total_net_weight': total_kg,
            'total_tonnage': round(float(total_kg) / 1000.0, 2),
            'total_transactions': total_count,
            'average_net_weight': round(float(total_kg) / total_count, 1) if total_count > 0 else 0,
            'trend': list(trend_qs)
        }
        
        return list(data), group_field, summary

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

    @staticmethod
    def get_shift_reconciliation(period='daily', custom_start=None, custom_end=None):
        start_date, end_date = ReportService.get_date_range(period, custom_start, custom_end)
        qs = WeighingTransaction.objects.all()
        if start_date:
            qs = qs.filter(first_weighing_datetime__gte=start_date)
        if end_date:
            qs = qs.filter(first_weighing_datetime__lte=end_date)

        # Breakdown by Operator Shift
        operator_summary = qs.values('operator__username').annotate(
            total_tickets=Count('id'),
            completed_tickets=Count('id', filter=Q(status='Completed')),
            pending_verification=Count('id', filter=Q(status='Pending Verification')),
            manual_overrides=Count('id', filter=Q(is_manual_entry=True)),
            total_net_weight=Sum('net_weight', filter=Q(status__in=['Completed', 'Corrected']))
        ).order_by('-total_tickets')

        # Overall shift tallies
        tallies = qs.aggregate(
            total_trips=Count('id'),
            completed_trips=Count('id', filter=Q(status='Completed')),
            manual_entries=Count('id', filter=Q(is_manual_entry=True)),
            corrections=Count('id', filter=Q(status='Corrected')),
            reversals=Count('id', filter=Q(status='Reversed')),
            total_net=Sum('net_weight', filter=Q(status__in=['Completed', 'Corrected']))
        )

        return {
            'operators': list(operator_summary),
            'summary': {
                'total_trips': tallies['total_trips'] or 0,
                'completed_trips': tallies['completed_trips'] or 0,
                'manual_entries': tallies['manual_entries'] or 0,
                'corrections': tallies['corrections'] or 0,
                'reversals': tallies['reversals'] or 0,
                'total_net_weight': tallies['total_net'] or 0,
                'total_tonnage': round(float(tallies['total_net'] or 0) / 1000.0, 2),
            }
        }
