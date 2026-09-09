from rest_framework.test import APITestCase
from rest_framework import status
from apps.users.models import User, Role

class PermissionAPITests(APITestCase):
    def setUp(self):
        # Create Roles
        self.admin_role = Role.objects.create(name='Administrator')
        self.operator_role = Role.objects.create(name='Weighbridge Operator')
        self.supervisor_role = Role.objects.create(name='Supervisor')
        self.manager_role = Role.objects.create(name='Manager')
        
        # Create Users
        self.admin = User.objects.create_user(username='admin', password='pw', role=self.admin_role)
        self.operator = User.objects.create_user(username='op', password='pw', role=self.operator_role)
        self.supervisor = User.objects.create_user(username='sup', password='pw', role=self.supervisor_role)
        self.manager = User.objects.create_user(username='mgr', password='pw', role=self.manager_role)

    def test_user_management_permissions(self):
        # Only admin should access /users/
        self.client.force_authenticate(user=self.operator)
        resp = self.client.get('/api/v1/users/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/v1/users/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_master_data_permissions(self):
        # Admin can manage master records (POST)
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post('/api/v1/materials/', {'name': 'Test Material'})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        
        # Operator cannot manage master records (POST)
        self.client.force_authenticate(user=self.operator)
        resp = self.client.post('/api/v1/materials/', {'name': 'Test Material 2'})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        
        # Operator CAN read master records (GET)
        resp = self.client.get('/api/v1/materials/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_weighing_permissions(self):
        # Operator can create transaction
        self.client.force_authenticate(user=self.operator)
        # Using dummy data, will fail validation but we just want to test permission (400 vs 403)
        resp = self.client.post('/api/v1/transactions/', {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Admin cannot create transaction (unless we add it, currently they don't have create_transactions)
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post('/api/v1/transactions/', {})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_audit_log_permissions(self):
        self.client.force_authenticate(user=self.supervisor)
        resp = self.client.get('/api/v1/audit/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        
        self.client.force_authenticate(user=self.operator)
        resp = self.client.get('/api/v1/audit/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_me_endpoint_returns_permissions(self):
        self.client.force_authenticate(user=self.operator)
        resp = self.client.get('/api/v1/auth/me/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('capture_weights', resp.data['permissions'])
        self.assertNotIn('manage_users', resp.data['permissions'])
