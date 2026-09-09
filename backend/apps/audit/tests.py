from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.audit.models import AuditLog
from apps.users.models import Role

User = get_user_model()

class AuditSystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_role = Role.objects.create(name='Administrator')
        self.user = User.objects.create_user(username='admin_test', password='password123', role=self.admin_role)
        
    def test_failed_login_creates_audit_log(self):
        initial_count = AuditLog.objects.filter(action='LOGIN_FAILED').count()
        response = self.client.post(reverse('token_obtain_pair'), {
            'username': 'admin_test',
            'password': 'wrongpassword'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(AuditLog.objects.filter(action='LOGIN_FAILED').count(), initial_count + 1)
        
    def test_login_creates_audit_log(self):
        initial_count = AuditLog.objects.filter(action='LOGIN').count()
        response = self.client.post(reverse('token_obtain_pair'), {
            'username': 'admin_test',
            'password': 'password123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(AuditLog.objects.filter(action='LOGIN').count(), initial_count + 1)
