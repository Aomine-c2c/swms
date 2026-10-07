from django.test import TestCase
from django.utils import timezone
from apps.weighing.models import WeighingTransaction
from apps.reports.services import ReportService
from apps.materials.models import Material
from apps.vehicles.models import Vehicle

class ReportServiceTests(TestCase):
    def setUp(self):
        self.material1 = Material.objects.create(name='Coal', status='Active')
        self.material2 = Material.objects.create(name='Iron Ore', status='Active')
        
        self.vehicle1 = Vehicle.objects.create(license_plate='AB123CD', vehicle_type='Truck')
        
        from apps.users.models import User, Role
        self.operator_role = Role.objects.create(name='Operator')
        self.operator = User.objects.create_user(username='op', password='op', role=self.operator_role)
        
        now = timezone.now()
        
        # Create some completed transactions
        WeighingTransaction.objects.create(
            vehicle=self.vehicle1,
            material=self.material1,
            operator=self.operator,
            gross_weight=5000,
            tare_weight=1000,
            net_weight=4000,
            status='Completed',
            first_weighing_datetime=now,
            second_weighing_datetime=now
        )
        
        WeighingTransaction.objects.create(
            vehicle=self.vehicle1,
            material=self.material1,
            operator=self.operator,
            gross_weight=6000,
            tare_weight=1000,
            net_weight=5000,
            status='Completed',
            first_weighing_datetime=now,
            second_weighing_datetime=now
        )
        
        WeighingTransaction.objects.create(
            vehicle=self.vehicle1,
            material=self.material2,
            operator=self.operator,
            gross_weight=8000,
            tare_weight=2000,
            net_weight=6000,
            status='Corrected',
            first_weighing_datetime=now,
            second_weighing_datetime=now
        )
        
        # Incomplete transaction
        WeighingTransaction.objects.create(
            vehicle=self.vehicle1,
            material=self.material1,
            operator=self.operator,
            gross_weight=4000,
            status='Open',
            first_weighing_datetime=now
        )

    def test_get_tonnage_report_by_material(self):
        # We expect Coal=9000 (2 tx), Iron Ore=6000 (1 tx)
        data, group_field, summary = ReportService.get_tonnage_report(period='daily', group_by='material')
        
        self.assertEqual(group_field, 'material__name')
        self.assertEqual(len(data), 2)
        self.assertEqual(summary['total_transactions'], 3)
        self.assertEqual(summary['total_net_weight'], 15000)
        
        # Sort or find
        coal_data = next((item for item in data if item['material__name'] == 'Coal'), None)
        iron_data = next((item for item in data if item['material__name'] == 'Iron Ore'), None)
        
        self.assertIsNotNone(coal_data)
        self.assertIsNotNone(iron_data)
        
        self.assertEqual(coal_data['total_net_weight'], 9000)
        self.assertEqual(coal_data['transaction_count'], 2)
        
        self.assertEqual(iron_data['total_net_weight'], 6000)
        self.assertEqual(iron_data['transaction_count'], 1)

    def test_get_status_report(self):
        # We expect Completed=2, Corrected=1, Open=1
        data = ReportService.get_status_report(period='daily')
        
        self.assertEqual(len(data), 3)
        
        completed_data = next((item for item in data if item['status'] == 'Completed'), None)
        open_data = next((item for item in data if item['status'] == 'Open'), None)
        
        self.assertIsNotNone(completed_data)
        self.assertEqual(completed_data['count'], 2)
        
        self.assertIsNotNone(open_data)
        self.assertEqual(open_data['count'], 1)


class ReportAPITests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from apps.users.models import User, Role
        from apps.materials.models import Material
        from apps.vehicles.models import Vehicle
        
        self.client = APIClient()
        self.admin_role = Role.objects.create(name='Administrator')
        self.operator_role = Role.objects.create(name='Operator')
        self.supervisor_role = Role.objects.create(name='Supervisor')
        
        self.admin = User.objects.create_user(username='admin_rep', password='password', role=self.admin_role)
        self.operator = User.objects.create_user(username='op_rep', password='password', role=self.operator_role)
        self.supervisor = User.objects.create_user(username='sup_rep', password='password', role=self.supervisor_role)
        
        self.material = Material.objects.create(name='Gravel', status='Active')
        self.vehicle = Vehicle.objects.create(license_plate='XYZ123', vehicle_type='Truck')
        
        WeighingTransaction.objects.create(
            vehicle=self.vehicle,
            material=self.material,
            operator=self.operator,
            gross_weight=5000,
            tare_weight=1000,
            net_weight=4000,
            status='Completed',
            first_weighing_datetime=timezone.now(),
            second_weighing_datetime=timezone.now()
        )

    def test_tonnage_report_api(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/v1/reports/engine/generate/?type=tonnage&period=daily&group_by=material')
        self.assertEqual(res.status_code, 200)
        self.assertIn('data', res.data)
        self.assertIn('group_field', res.data)

    def test_status_report_api(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/v1/reports/engine/generate/?type=status&period=daily')
        self.assertEqual(res.status_code, 200)
        self.assertIn('data', res.data)

    def test_activity_report_permissions(self):
        # Operator cannot access activity report
        self.client.force_authenticate(user=self.operator)
        res = self.client.get('/api/v1/reports/engine/generate/?type=activity&period=daily')
        self.assertEqual(res.status_code, 403)

        # Supervisor can access activity report
        self.client.force_authenticate(user=self.supervisor)
        res = self.client.get('/api/v1/reports/engine/generate/?type=activity&period=daily')
        self.assertEqual(res.status_code, 200)

        # Admin can access activity report
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/v1/reports/engine/generate/?type=activity&period=daily')
        self.assertEqual(res.status_code, 200)

    def test_export_report_csv(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/v1/reports/engine/export/?type=tonnage&period=daily&group_by=material')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'text/csv')
        self.assertIn('attachment', res['Content-Disposition'])

    def test_invalid_report_type(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/v1/reports/engine/generate/?type=invalid_type')
        self.assertEqual(res.status_code, 400)

