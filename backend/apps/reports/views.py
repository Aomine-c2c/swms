from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Count, Sum
from datetime import datetime, timedelta
import csv
from django.http import HttpResponse
from datetime import timedelta

from apps.weighing.models import WeighingTransaction, ApprovalRequest
from apps.weighing.serializers import WeighingTransactionSerializer
from apps.users.models import User
from apps.vehicles.models import Vehicle
from apps.materials.models import Material
from apps.audit.models import AuditLog

from apps.reports.services import ReportService

class ReportViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _parse_dates(self, request):
        custom_start = request.query_params.get('date_from')
        custom_end = request.query_params.get('date_to')
        
        start_date = None
        end_date = None
        
        if custom_start:
            start_date = datetime.strptime(custom_start, '%Y-%m-%d')
        if custom_end:
            end_date = datetime.strptime(custom_end, '%Y-%m-%d') + timedelta(days=1, seconds=-1)
            
        return start_date, end_date

    @action(detail=False, methods=['get'])
    def generate(self, request):
        report_type = request.query_params.get('type')
        period = request.query_params.get('period', 'daily')
        group_by = request.query_params.get('group_by', 'material')
        
        start_date, end_date = self._parse_dates(request)
        
        if report_type == 'tonnage':
            data, group_field, summary = ReportService.get_tonnage_report(period, group_by, start_date, end_date)
            return Response({'data': data, 'group_field': group_field, 'summary': summary})
            
        elif report_type == 'status':
            data = ReportService.get_status_report(period, start_date, end_date)
            return Response({'data': data})
            
        elif report_type == 'activity':
            role_name = request.user.role.name if getattr(request.user, 'role', None) else ''
            if not (request.user.is_superuser or role_name in ['Manager', 'Administrator', 'Supervisor']):
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            data = ReportService.get_activity_report(period, start_date, end_date)
            return Response({'data': data})

        elif report_type == 'shift':
            role_name = request.user.role.name if getattr(request.user, 'role', None) else ''
            if not (request.user.is_superuser or role_name in ['Manager', 'Administrator', 'Supervisor']):
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            shift_data = ReportService.get_shift_reconciliation(period, start_date, end_date)
            return Response(shift_data)
            
        return Response({'error': 'Invalid report type'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def export(self, request):
        report_type = request.query_params.get('type')
        period = request.query_params.get('period', 'daily')
        group_by = request.query_params.get('group_by', 'material')
        
        start_date, end_date = self._parse_dates(request)
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{report_type}_report_{period}.csv"'
        
        writer = csv.writer(response)
        
        if report_type == 'tonnage':
            data, group_field, summary = ReportService.get_tonnage_report(period, group_by, start_date, end_date)
            writer.writerow([group_field.replace('__name', '').replace('__license_plate', '').capitalize(), 'Total Net Weight (kg)', 'Transaction Count'])
            for row in data:
                writer.writerow([row[group_field], row['total_net_weight'] or 0, row['transaction_count']])
                
        elif report_type == 'status':
            data = ReportService.get_status_report(period, start_date, end_date)
            writer.writerow(['Status', 'Count'])
            for row in data:
                writer.writerow([row['status'], row['count']])
                
        elif report_type == 'activity':
            role_name = request.user.role.name if getattr(request.user, 'role', None) else ''
            if not (request.user.is_superuser or role_name in ['Manager', 'Administrator', 'Supervisor']):
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            data = ReportService.get_activity_report(period, start_date, end_date)
            writer.writerow(['User', 'Action', 'Count'])
            for row in data:
                writer.writerow([row['user__username'], row['action'], row['count']])

        elif report_type == 'shift':
            role_name = request.user.role.name if getattr(request.user, 'role', None) else ''
            if not (request.user.is_superuser or role_name in ['Manager', 'Administrator', 'Supervisor']):
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            shift_data = ReportService.get_shift_reconciliation(period, start_date, end_date)
            writer.writerow(['Operator', 'Total Tickets', 'Completed', 'Pending Verification', 'Manual Overrides', 'Net Weight (kg)'])
            for op in shift_data['operators']:
                writer.writerow([
                    op['operator__username'],
                    op['total_tickets'],
                    op['completed_tickets'],
                    op['pending_verification'],
                    op['manual_overrides'],
                    op['total_net_weight'] or 0
                ])
                
        else:
            return Response({'error': 'Invalid report type'}, status=status.HTTP_400_BAD_REQUEST)
            
        return response

class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def operator_summary(self, request):
        user = request.user

        from django.db.models import Count, Q
        
        # If user is admin, supervisor, or manager, show terminal-wide counts; else scope to operator
        role_name = getattr(user.role, 'name', '') if hasattr(user, 'role') and user.role else ''
        is_management = user.is_superuser or role_name in ['Administrator', 'Manager', 'Supervisor']

        tx_qs = WeighingTransaction.objects.all() if is_management else WeighingTransaction.objects.filter(operator=user)

        counts = tx_qs.aggregate(
            open_count=Count('id', filter=Q(status='Open')),
            pending_count=Count('id', filter=Q(status='Pending Verification')),
        )

        recent_tickets = (
            tx_qs
            .filter(status='Completed')
            .select_related('vehicle', 'material', 'driver', 'supplier', 'operator', 'ticket')
            .order_by('-first_weighing_datetime')[:5]
        )

        return Response({
            'open_transactions': counts['open_count'],
            'pending_verifications': counts['pending_count'],
            'recent_tickets': WeighingTransactionSerializer(recent_tickets, many=True).data
        })

    @action(detail=False, methods=['get'])
    def supervisor_summary(self, request):
        today = timezone.now().date()

        from django.db.models import Count, Q
        # Single aggregated query for all status counts
        status_counts = WeighingTransaction.objects.aggregate(
            pending_count=Count('id', filter=Q(status='Pending Verification')),
            corrections=Count('id', filter=Q(status='Corrected', updated_at__date=today)),
            reversals=Count('id', filter=Q(status='Reversed', updated_at__date=today)),
        )

        recent_exceptions = (
            WeighingTransaction.objects
            .filter(status__in=['Pending Verification', 'Corrected', 'Reversed'])
            .select_related('vehicle', 'material', 'driver', 'supplier', 'operator', 'ticket')
            .order_by('-updated_at')[:5]
        )

        pending_approvals = ApprovalRequest.objects.filter(status='PENDING').count()

        return Response({
            'pending_verifications': status_counts['pending_count'],
            'pending_approvals': pending_approvals,
            'corrections_today': status_counts['corrections'],
            'reversals_today': status_counts['reversals'],
            'recent_exceptions': WeighingTransactionSerializer(recent_exceptions, many=True).data
        })

    @action(detail=False, methods=['get'])
    def manager_summary(self, request):
        today = timezone.now().date()
        
        completed_today = WeighingTransaction.objects.filter(
            status__in=['Completed', 'Corrected'],
            first_weighing_datetime__date=today
        )

        daily_tonnage = completed_today.aggregate(total=Sum('net_weight'))['total'] or 0
        vehicle_count = completed_today.values('vehicle').distinct().count()

        materials_moved = completed_today.values('material__name').annotate(
            total_weight=Sum('net_weight')
        ).order_by('-total_weight')

        # Last 7 days trend with count & tonnage
        last_7_days = today - timedelta(days=7)
        trends = WeighingTransaction.objects.filter(
            first_weighing_datetime__date__gte=last_7_days,
            first_weighing_datetime__date__lte=today,
            status__in=['Completed', 'Corrected']
        ).values('first_weighing_datetime__date').annotate(
            count=Count('id'),
            tonnage=Sum('net_weight')
        ).order_by('first_weighing_datetime__date')

        return Response({
            'daily_tonnage': daily_tonnage,
            'vehicle_count': vehicle_count,
            'materials_moved': list(materials_moved),
            'transaction_trends': list(trends)
        })

    @action(detail=False, methods=['get'])
    def admin_summary(self, request):
        today = timezone.now().date()
        
        active_users = User.objects.filter(status='Active').count()
        
        vehicles = Vehicle.objects.count()
        materials = Material.objects.count()
        
        audit_today = AuditLog.objects.filter(action_datetime__date=today).count()
        
        # We don't have a strict "failed logins" table yet, so we will omit or mock it
        # Can pull from AuditLog if we recorded them

        return Response({
            'active_users': active_users,
            'system_status': {
                'total_vehicles': vehicles,
                'total_materials': materials
            },
            'audit_activity_today': audit_today
        })
