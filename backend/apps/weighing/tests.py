from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.vehicles.models import Vehicle
from apps.materials.models import Material
from apps.weighing.models import WeighingTransaction
from apps.users.models import Role, User
from apps.weighing.services import (
    create_weighing_transaction,
    complete_weighing_transaction,
    cancel_weighing_transaction,
    flag_weighing_transaction,
    approve_weighing_transaction,
    correct_weighing_transaction,
    reverse_weighing_transaction
)

class WeighingTransactionStateMachineTest(TestCase):
    def setUp(self):
        self.role = Role.objects.create(name='Operator')
        self.operator = User.objects.create_user(username='op', password='op')
        self.operator.role = self.role
        self.operator.save()

        self.vehicle = Vehicle.objects.create(license_plate='TEST-123')
        self.material = Material.objects.create(name='Sand')

    def test_legal_workflow_open_to_complete(self):
        # 1. First weighing (Gross)
        trans = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=15000,
            vehicle=self.vehicle,
            material=self.material
        )
        self.assertEqual(trans.status, 'Open')
        self.assertEqual(trans.gross_weight, 15000)

        # 2. Second weighing (Tare)
        trans = complete_weighing_transaction(
            user=self.operator,
            transaction_id=trans.id,
            weight=5000
        )
        self.assertEqual(trans.status, 'Completed')
        self.assertEqual(trans.net_weight, 10000)

    def test_legal_workflow_open_to_cancel(self):
        trans = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=15000,
            vehicle=self.vehicle,
            material=self.material
        )
        trans = cancel_weighing_transaction(self.operator, trans.id, "Customer left")
        self.assertEqual(trans.status, 'Cancelled')

    def test_legal_workflow_flag_to_approve(self):
        trans = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=15000,
            vehicle=self.vehicle,
            material=self.material
        )
        trans = flag_weighing_transaction(self.operator, trans.id, "Weight looks suspiciously low")
        self.assertEqual(trans.status, 'Pending Verification')

        trans = approve_weighing_transaction(self.operator, trans.id, 5000)
        self.assertEqual(trans.status, 'Completed')
        self.assertEqual(trans.net_weight, 10000)

    def test_legal_workflow_complete_to_correct(self):
        trans = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=15000,
            vehicle=self.vehicle,
            material=self.material
        )
        trans = complete_weighing_transaction(self.operator, trans.id, 5000)
        
        # Correct the tare weight
        trans = correct_weighing_transaction(self.operator, trans.id, "Typo in tare", tare_weight=4000)
        self.assertEqual(trans.status, 'Corrected')
        self.assertEqual(trans.net_weight, 11000)

    def test_legal_workflow_complete_to_reverse(self):
        trans = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=15000,
            vehicle=self.vehicle,
            material=self.material
        )
        trans = complete_weighing_transaction(self.operator, trans.id, 5000)
        
        trans = reverse_weighing_transaction(self.operator, trans.id, "Wrong vehicle selected")
        self.assertEqual(trans.status, 'Reversed')

    def test_illegal_workflow_reverse_open(self):
        trans = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=15000,
            vehicle=self.vehicle,
            material=self.material
        )
        with self.assertRaises(ValidationError):
            reverse_weighing_transaction(self.operator, trans.id, "Try reverse open")

    def test_illegal_workflow_complete_already_completed(self):
        trans = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=15000,
            vehicle=self.vehicle,
            material=self.material
        )
        trans = complete_weighing_transaction(self.operator, trans.id, 5000)
        
        with self.assertRaises(ValidationError):
            complete_weighing_transaction(self.operator, trans.id, 4000)

    def test_illegal_workflow_correct_open(self):
        trans = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=15000,
            vehicle=self.vehicle,
            material=self.material
        )
        with self.assertRaises(ValidationError):
            correct_weighing_transaction(self.operator, trans.id, "Try correct open", tare_weight=4000)

class WeighingTransactionSearchTest(TestCase):
    def setUp(self):
        self.operator_role = Role.objects.create(name='Weighbridge Operator')
        self.admin_role = Role.objects.create(name='Supervisor')
        
        self.operator1 = User.objects.create_user(username='op1', password='op')
        self.operator1.role = self.operator_role
        self.operator1.save()

        self.operator2 = User.objects.create_user(username='op2', password='op')
        self.operator2.role = self.operator_role
        self.operator2.save()

        self.admin = User.objects.create_user(username='admin', password='adm')
        self.admin.role = self.admin_role
        self.admin.save()

        self.vehicle1 = Vehicle.objects.create(license_plate='TRUCK-A')
        self.vehicle2 = Vehicle.objects.create(license_plate='TRUCK-B')
        self.material = Material.objects.create(name='Gravel')

        self.t1 = create_weighing_transaction(
            user=self.operator1, weight_type='gross', weight=10000, 
            vehicle=self.vehicle1, material=self.material
        )
        self.t2 = create_weighing_transaction(
            user=self.operator2, weight_type='gross', weight=20000, 
            vehicle=self.vehicle2, material=self.material
        )

    def test_operator_can_only_see_own_transactions(self):
        from rest_framework.test import APIRequestFactory
        from apps.weighing.views import WeighingTransactionViewSet
        factory = APIRequestFactory()
        view = WeighingTransactionViewSet.as_view({'get': 'list'})
        
        request = factory.get('/transactions/')
        request.user = self.operator1
        response = view(request)
        
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.t1.id)

    def test_admin_can_see_all_transactions(self):
        from rest_framework.test import APIRequestFactory
        from apps.weighing.views import WeighingTransactionViewSet
        factory = APIRequestFactory()
        view = WeighingTransactionViewSet.as_view({'get': 'list'})
        
        request = factory.get('/transactions/')
        request.user = self.admin
        response = view(request)
        
        results = response.data.get('results', response.data)
        print("TRANSACTIONS IN TEST:", results)
        self.assertEqual(len(results), 2)

    def test_search_by_vehicle(self):
        from rest_framework.test import APIRequestFactory
        from apps.weighing.views import WeighingTransactionViewSet
        factory = APIRequestFactory()
        view = WeighingTransactionViewSet.as_view({'get': 'list'})
        
        request = factory.get('/transactions/?search=TRUCK-B')
        request.user = self.admin
        response = view(request)
        
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.t2.id)

class ApprovalSystemTest(TestCase):
    def setUp(self):
        self.operator_role = Role.objects.create(name='Weighbridge Operator')
        self.admin_role = Role.objects.create(name='Supervisor')
        
        self.operator = User.objects.create_user(username='op1', password='op', role=self.operator_role)
        self.admin = User.objects.create_user(username='admin', password='adm', role=self.admin_role)

        self.vehicle = Vehicle.objects.create(license_plate='TRUCK-A')
        self.material = Material.objects.create(name='Gravel')

        self.trans = create_weighing_transaction(
            user=self.operator, weight_type='gross', weight=10000, 
            vehicle=self.vehicle, material=self.material
        )
        complete_weighing_transaction(self.operator, self.trans.id, 5000)

    def test_request_reversal_creates_pending_approval(self):
        from apps.weighing.approval_services import request_approval
        req = request_approval(self.operator, self.trans.id, 'REVERSAL', 'Wrong vehicle')
        self.assertEqual(req.status, 'PENDING')
        
    def test_supervisor_cannot_approve_own_request(self):
        from apps.weighing.approval_services import request_approval, approve_request
        req = request_approval(self.admin, self.trans.id, 'REVERSAL', 'Test')
        with self.assertRaises(ValidationError):
            approve_request(self.admin, req.id, 'Looks good')
            
    def test_supervisor_approves_reversal(self):
        from apps.weighing.approval_services import request_approval, approve_request
        from apps.weighing.models import WeighingTransaction
        req = request_approval(self.operator, self.trans.id, 'REVERSAL', 'Wrong vehicle')
        approve_request(self.admin, req.id, 'Approved')
        
        self.trans.refresh_from_db()
        self.assertEqual(self.trans.status, 'Reversed')
        
        req.refresh_from_db()
        self.assertEqual(req.status, 'APPROVED')

