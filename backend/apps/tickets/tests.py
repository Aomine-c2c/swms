from django.test import TestCase
from apps.tickets.models import Ticket
from apps.weighing.models import WeighingTransaction
from apps.vehicles.models import Vehicle
from apps.materials.models import Material
from apps.users.models import Role, User
from django.utils import timezone
from apps.weighing.services import create_weighing_transaction, complete_weighing_transaction

class TicketModelTest(TestCase):
    def setUp(self):
        self.role = Role.objects.create(name='Operator')
        self.operator = User.objects.create_user(username='op', password='op')
        self.operator.role = self.role
        self.operator.save()

        self.vehicle = Vehicle.objects.create(license_plate='TEST-123')
        self.material = Material.objects.create(name='Sand')
        
    def test_ticket_creation_on_completion(self):
        trans = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=15000,
            vehicle=self.vehicle,
            material=self.material
        )
        
        # Complete should generate a ticket
        trans = complete_weighing_transaction(self.operator, trans.id, 5000)
        
        self.assertTrue(hasattr(trans, 'ticket'))
        self.assertIsNotNone(trans.ticket)
        self.assertTrue(trans.ticket.ticket_number.startswith('TKT-'))
        self.assertEqual(trans.ticket.print_count, 0)
