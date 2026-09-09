from rest_framework.test import APITestCase
from rest_framework import status
from django.core.cache import cache
from apps.users.models import User, Role

class AuthAPITests(APITestCase):
    def setUp(self):
        self.role = Role.objects.create(name='Administrator')
        self.user = User.objects.create_user(username='testadmin', password='correctpassword', role=self.role)
        # Clear cache to reset rate limiters
        cache.clear()

    def test_successful_login(self):
        response = self.client.post('/api/v1/auth/token/', {
            'username': 'testadmin',
            'password': 'correctpassword'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_invalid_login(self):
        response = self.client.post('/api/v1/auth/token/', {
            'username': 'testadmin',
            'password': 'wrongpassword'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inactive_account(self):
        self.user.is_active = False
        self.user.save()
        
        response = self.client.post('/api/v1/auth/token/', {
            'username': 'testadmin',
            'password': 'correctpassword'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('No active account found', str(response.data))

    def test_rate_limiting(self):
        # We configured 5/min in settings.py
        for _ in range(5):
            response = self.client.post('/api/v1/auth/token/', {
                'username': 'testadmin',
                'password': 'wrongpassword'
            })
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
            
        # 6th attempt should be throttled
        response = self.client.post('/api/v1/auth/token/', {
            'username': 'testadmin',
            'password': 'wrongpassword'
        })
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_current_user_endpoint(self):
        # Unauthenticated
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # Authenticated
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testadmin')
        self.assertEqual(response.data['role_details']['name'], 'Administrator')
