from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.users.views import UserViewSet, RoleViewSet
from apps.core.views import VehicleViewSet, DriverViewSet, SupplierViewSet, MaterialViewSet, GlobalSearchView, CarrierViewSet
from apps.weighing.views import WeighingTransactionViewSet, ApprovalRequestViewSet
from apps.tickets.views import TicketViewSet
from apps.audit.views import AuditLogViewSet
from apps.reports.views import DashboardViewSet, ReportViewSet
from apps.system.views import BackupViewSet, SystemSettingViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'roles', RoleViewSet, basename='roles')
router.register(r'carriers', CarrierViewSet, basename='carriers')
router.register(r'vehicles', VehicleViewSet, basename='vehicles')
router.register(r'drivers', DriverViewSet, basename='drivers')
router.register(r'suppliers', SupplierViewSet, basename='suppliers')
router.register(r'materials', MaterialViewSet, basename='materials')
router.register(r'transactions', WeighingTransactionViewSet, basename='transactions')
router.register(r'approvals', ApprovalRequestViewSet, basename='approvals')
router.register(r'tickets', TicketViewSet, basename='tickets')
router.register(r'audit', AuditLogViewSet, basename='audit')
router.register(r'reports/dashboard', DashboardViewSet, basename='dashboard')
router.register(r'reports/engine', ReportViewSet, basename='reports-engine')
router.register(r'system/backups', BackupViewSet, basename='system-backups')
router.register(r'system/settings', SystemSettingViewSet, basename='system-settings')

urlpatterns = [
    path('search/', GlobalSearchView.as_view(), name='global-search'),
    path('', include(router.urls)),
]
