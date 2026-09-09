from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from apps.users.models import User, Role
from apps.vehicles.models import Vehicle
from apps.materials.models import Material
from apps.weighing.models import WeighingTransaction
from apps.audit.models import AuditLog
from apps.tickets.models import Ticket

class TransactionAPITests(APITestCase):
    def setUp(self):
        self.operator_role = Role.objects.create(name='Weighbridge Operator')
        self.supervisor_role = Role.objects.create(name='Supervisor')
        
        self.operator = User.objects.create_user(username='op', password='op')
        self.operator.role = self.operator_role
        self.operator.save()
        
        self.supervisor = User.objects.create_user(username='sup', password='sup')
        self.supervisor.role = self.supervisor_role
        self.supervisor.save()
        
        self.vehicle = Vehicle.objects.create(license_plate='TEST-123')
        self.material = Material.objects.create(name='Sand')

    def test_unauthenticated_request(self):
        response = self.client.post('/api/v1/transactions/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_transaction_and_audit(self):
        self.client.force_authenticate(user=self.operator)
        data = {
            'vehicle': self.vehicle.id,
            'material': self.material.id,
            'weight_type': 'gross',
            'weight': 5000
        }
        response = self.client.post('/api/v1/transactions/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        trans_id = response.data['id']
        trans = WeighingTransaction.objects.get(id=trans_id)
        
        # Second weighing (Tare) to get net weight
        response2 = self.client.post(f'/api/v1/transactions/{trans.id}/complete/', {'weight': 2000})
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        trans.refresh_from_db()
        
        # Verify net weight was calculated server-side
        self.assertEqual(trans.net_weight, 3000)
        
        # Verify Ticket generation
        self.assertTrue(Ticket.objects.filter(transaction=trans).exists())
        
        # Verify Audit log created
        self.assertTrue(AuditLog.objects.filter(record_id=str(trans.id), action='CREATE').exists())

    def test_invalid_weight(self):
        # Create an open transaction with 5000 gross weight
        trans = WeighingTransaction.objects.create(
            vehicle=self.vehicle,
            material=self.material,
            operator=self.operator,
            first_weighing_datetime=timezone.now(),
            gross_weight=5000,
            status='Open'
        )
        
        self.client.force_authenticate(user=self.operator)
        # Try to complete with a tare weight greater than gross
        response = self.client.post(f'/api/v1/transactions/{trans.id}/complete/', {'weight': 6000})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Tare weight cannot be greater than gross weight.', str(response.data))

    def test_correction_authorization(self):
        # Create completed transaction first
        trans = WeighingTransaction.objects.create(
            vehicle=self.vehicle,
            material=self.material,
            operator=self.operator,
            first_weighing_datetime=timezone.now(),
            gross_weight=5000,
            tare_weight=1000,
            status='Completed'
        )
        
        self.client.force_authenticate(user=self.operator)
        # Operator cannot correct
        response = self.client.post(f'/api/v1/transactions/{trans.id}/correct/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Supervisor can correct
        self.client.force_authenticate(user=self.supervisor)
        response = self.client.post(f'/api/v1/transactions/{trans.id}/correct/', {'gross_weight': 4000, 'reason': 'Testing correction'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        trans.refresh_from_db()
        self.assertEqual(trans.gross_weight, 4000)
        self.assertEqual(trans.net_weight, 3000)
        self.assertEqual(trans.status, 'Corrected')
        self.assertTrue(AuditLog.objects.filter(record_id=str(trans.id), action='CORRECT').exists())
