from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.reports.views import DashboardViewSet, ReportViewSet

router = DefaultRouter()
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'engine', ReportViewSet, basename='report_engine')

urlpatterns = [
    path('', include(router.urls)),
]
