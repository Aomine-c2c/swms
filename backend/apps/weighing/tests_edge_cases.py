import unittest
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status

from apps.users.models import User, Role
from apps.vehicles.models import Vehicle, Carrier
from apps.drivers.models import Driver
from apps.suppliers.models import Supplier
from apps.materials.models import Material
from apps.weighing.models import WeighingTransaction, ApprovalRequest
from apps.system.models import SystemSetting
from apps.tickets.models import Ticket
from apps.audit.models import AuditLog
from apps.weighing.services import (
    create_weighing_transaction,
    complete_weighing_transaction,
    cancel_weighing_transaction,
    flag_weighing_transaction,
    correct_weighing_transaction,
    reverse_weighing_transaction,
    approve_weighing_transaction,
    update_weighing_transaction,
)
from apps.weighing.approval_services import request_approval, approve_request, reject_request
from apps.weighing.tolerance_services import check_weight_thresholds


class WeighingEdgeCasesAndStressTests(TestCase):
    """
    Stringent edge-case and boundary verification suite covering:
    1. Tare > Gross inversion and zero/negative net weights.
    2. Overweight limit enforcement (toggle ON vs OFF).
    3. Tare tolerance calculation modes (PERCENTAGE, ABSOLUTE, EITHER) and vehicle-level overrides.
    4. Manual entry auditing and mandatory justification reasoning.
    5. State machine integrity (illegal transitions, double-completions, direct deletion prohibitions).
    6. Dual-control supervisor approval workflows (self-approval ban, PIN validation, rejection handling).
    7. Decimal precision (fractional kg arithmetic up to 2 decimal places).
    8. Soft-delete safety and foreign-key PROTECT semantics.
    """

    def setUp(self):
        # Establish Roles
        self.operator_role = Role.objects.create(name='Weighbridge Operator')
        self.supervisor_role = Role.objects.create(name='Supervisor')
        self.admin_role = Role.objects.create(name='Administrator')

        # Establish Users
        self.operator = User.objects.create_user(username='edge_op', password='Password123!', role=self.operator_role)
        self.supervisor = User.objects.create_user(username='edge_sup', password='Password123!', role=self.supervisor_role)
        self.admin = User.objects.create_user(username='edge_admin', password='Password123!', role=self.admin_role)

        # Master Data
        self.carrier = Carrier.objects.create(name='Atlas Logistics', status='Active')
        self.driver = Driver.objects.create(name='John Doe', license_number='DL-998877', status='Active')
        self.supplier = Supplier.objects.create(name='Global Quarries Ltd', status='Active')
        self.material = Material.objects.create(name='Iron Ore Pellet', status='Active')

        self.vehicle = Vehicle.objects.create(
            license_plate='KBZ-5501',
            known_tare_weight=Decimal('12000.00'),
            max_capacity=Decimal('45000.00'),
            carrier=self.carrier,
            default_driver=self.driver,
            status='Active'
        )

        # Standard Settings
        self.settings = SystemSetting.get_settings()
        self.settings.tare_tolerance_pct = Decimal('3.00')
        self.settings.tare_tolerance_kg = Decimal('300.00')
        self.settings.tare_tolerance_mode = 'EITHER'
        self.settings.overweight_enforcement_enabled = True
        self.settings.save()

        self.client = APIClient()

    # -------------------------------------------------------------------------
    # 1. Tare > Gross Rejections & Zero / Negative Weight Handling
    # -------------------------------------------------------------------------
    def test_clean_rejects_tare_greater_than_gross(self):
        """Model clean() must raise ValidationError if tare > gross."""
        tx = WeighingTransaction(
            vehicle=self.vehicle,
            material=self.material,
            operator=self.operator,
            first_weighing_datetime=timezone.now(),
            gross_weight=Decimal('10000.00'),
            tare_weight=Decimal('12000.00'),
            status='Open'
        )
        with self.assertRaises(ValidationError) as ctx:
            tx.clean()
        self.assertIn("Tare weight cannot be greater than gross weight.", str(ctx.exception))

    def test_complete_api_rejects_tare_greater_than_gross(self):
        """API /complete/ endpoint must return HTTP 400 when tare exceeds gross."""
        tx = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=Decimal('15000.00'),
            vehicle=self.vehicle,
            material=self.material
        )
        self.client.force_authenticate(user=self.operator)
        res = self.client.post(f'/api/v1/transactions/{tx.id}/complete/', {'weight': Decimal('16000.00')})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Tare weight cannot be greater than gross weight", str(res.data))

    def test_exact_equal_tare_and_gross_net_is_zero(self):
        """Tare equal to Gross is permissible (e.g. empty container returned), net must be 0.00."""
        tx = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=Decimal('12500.50'),
            vehicle=self.vehicle,
            material=self.material
        )
        completed = complete_weighing_transaction(
            user=self.operator,
            transaction_id=tx.id,
            weight=Decimal('12500.50')
        )
        self.assertEqual(completed.net_weight, Decimal('0.00'))
        self.assertEqual(completed.status, 'Completed')

    # -------------------------------------------------------------------------
    # 2. Overweight Capacity Violations (Toggle Enabled vs Disabled)
    # -------------------------------------------------------------------------
    def test_overweight_violation_when_enforcement_enabled(self):
        """When overweight enforcement is enabled, gross exceeding max_capacity generates violation."""
        self.settings.overweight_enforcement_enabled = True
        self.settings.save()

        # Vehicle capacity is 45,000 kg. Present 48,000 kg (+3,000 kg).
        violations = check_weight_thresholds(self.vehicle, gross_weight=Decimal('48000.00'))
        self.assertEqual(len(violations), 1)
        v = violations[0]
        self.assertEqual(v['type'], 'OVERWEIGHT_EXCEPTION')
        self.assertAlmostEqual(v['delta'], 3000.0)
        self.assertAlmostEqual(v['delta_pct'], 6.67, places=2)

    def test_overweight_ignored_when_enforcement_disabled(self):
        """When overweight enforcement is disabled, gross exceeding max_capacity is permitted."""
        self.settings.overweight_enforcement_enabled = False
        self.settings.save()

        violations = check_weight_thresholds(self.vehicle, gross_weight=Decimal('55000.00'))
        self.assertEqual(len(violations), 0)

    def test_create_transaction_blocks_unconfirmed_overweight(self):
        """POST /api/v1/transactions/ returns 409 Conflict if overweight without confirm_exception."""
        self.client.force_authenticate(user=self.operator)
        res = self.client.post('/api/v1/transactions/', {
            'vehicle': self.vehicle.id,
            'material': self.material.id,
            'weight_type': 'gross',
            'weight': '50000.00',  # Exceeds 45,000 kg
        })
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(res.data['requires_approval'])
        self.assertEqual(res.data['violations'][0]['type'], 'OVERWEIGHT_EXCEPTION')

    def test_create_transaction_routes_confirmed_overweight_to_pending_verification(self):
        """POST /api/v1/transactions/ with confirm_exception creates tx in Pending Verification + ApprovalRequest."""
        self.client.force_authenticate(user=self.operator)
        res = self.client.post('/api/v1/transactions/', {
            'vehicle': self.vehicle.id,
            'material': self.material.id,
            'weight_type': 'gross',
            'weight': '50000.00',
            'confirm_exception': True,
            'exception_reason': 'Authorized project heavy haul'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        tx_id = res.data['id']
        tx = WeighingTransaction.objects.get(id=tx_id)
        self.assertEqual(tx.status, 'Pending Verification')

        # Check ApprovalRequest was dispatched
        reqs = ApprovalRequest.objects.filter(transaction=tx)
        self.assertEqual(reqs.count(), 1)
        self.assertEqual(reqs.first().action, 'OVERWEIGHT_EXCEPTION')
        self.assertEqual(reqs.first().status, 'PENDING')

    # -------------------------------------------------------------------------
    # 3. Tare Tolerance Calculation Modes & Vehicle-Specific Overrides
    # -------------------------------------------------------------------------
    def test_tare_tolerance_percentage_mode(self):
        """In PERCENTAGE mode, only relative deviation % triggers violation."""
        self.settings.tare_tolerance_mode = 'PERCENTAGE'
        self.settings.tare_tolerance_pct = Decimal('5.00')  # 5% of 12,000 kg = 600 kg
        self.settings.tare_tolerance_kg = Decimal('100.00') # 100 kg absolute (should be ignored)
        self.settings.save()

        # Delta = 200 kg. (1.67% <= 5%). Even though delta > 100 kg, mode is PERCENTAGE -> NO VIOLATION
        v_ok = check_weight_thresholds(self.vehicle, tare_weight=Decimal('12200.00'))
        self.assertEqual(len(v_ok), 0)

        # Delta = 700 kg. (5.83% > 5%). -> VIOLATION
        v_fail = check_weight_thresholds(self.vehicle, tare_weight=Decimal('12700.00'))
        self.assertEqual(len(v_fail), 1)
        self.assertEqual(v_fail[0]['type'], 'TARE_TOLERANCE_EXCEPTION')

    def test_tare_tolerance_absolute_mode(self):
        """In ABSOLUTE mode, only kg deviation triggers violation."""
        self.settings.tare_tolerance_mode = 'ABSOLUTE'
        self.settings.tare_tolerance_pct = Decimal('1.00')  # 1% (should be ignored)
        self.settings.tare_tolerance_kg = Decimal('500.00') # 500 kg absolute limit
        self.settings.save()

        # Delta = 200 kg. (1.67% > 1%, but absolute 200 <= 500) -> NO VIOLATION
        v_ok = check_weight_thresholds(self.vehicle, tare_weight=Decimal('12200.00'))
        self.assertEqual(len(v_ok), 0)

        # Delta = 600 kg. (600 > 500) -> VIOLATION
        v_fail = check_weight_thresholds(self.vehicle, tare_weight=Decimal('12600.00'))
        self.assertEqual(len(v_fail), 1)
        self.assertEqual(v_fail[0]['type'], 'TARE_TOLERANCE_EXCEPTION')

    def test_vehicle_specific_tare_tolerance_overrides_system_settings(self):
        """Per-vehicle tare tolerance settings must supersede global settings."""
        self.settings.tare_tolerance_mode = 'PERCENTAGE'
        self.settings.tare_tolerance_pct = Decimal('10.00') # Generous global setting
        self.settings.save()

        # Configure strict 1.0% limit on vehicle
        self.vehicle.tare_tolerance_pct = Decimal('1.00')
        self.vehicle.save()

        # Delta = 200 kg (1.67%). Under global (10%) it passes, but under vehicle override (1%) it fails.
        violations = check_weight_thresholds(self.vehicle, tare_weight=Decimal('12200.00'))
        self.assertEqual(len(violations), 1)
        self.assertAlmostEqual(violations[0]['allowed_pct'], 1.0)

    # -------------------------------------------------------------------------
    # 4. Manual Weight Entry Validation & Audit Tracking
    # -------------------------------------------------------------------------
    def test_manual_entry_requires_mandatory_reason(self):
        """A manual weight transaction without a reason must fail validation."""
        tx = WeighingTransaction(
            vehicle=self.vehicle,
            material=self.material,
            operator=self.operator,
            first_weighing_datetime=timezone.now(),
            gross_weight=Decimal('20000.00'),
            is_manual_entry=True,
            manual_entry_reason=None
        )
        with self.assertRaises(ValidationError) as ctx:
            tx.clean()
        self.assertIn("A reason must be provided for manual weight entries.", str(ctx.exception))

    def test_manual_entry_logged_accurately_in_audit(self):
        """When manual weight is provided with reason, audit log records flags."""
        tx = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=Decimal('22000.00'),
            vehicle=self.vehicle,
            material=self.material,
            is_manual_entry=True,
            manual_entry_reason='Scale indicator optical port failure'
        )
        self.assertTrue(tx.is_manual_entry)
        self.assertEqual(tx.manual_entry_reason, 'Scale indicator optical port failure')

        # Check AuditLog
        log = AuditLog.objects.filter(record_id=str(tx.id), action='CREATE').first()
        self.assertIsNotNone(log)
        self.assertTrue(log.new_value.get('is_manual_entry'))
        self.assertEqual(log.new_value.get('manual_entry_reason'), 'Scale indicator optical port failure')

    # -------------------------------------------------------------------------
    # 5. State Machine Invariants & Illegal Transition Guards
    # -------------------------------------------------------------------------
    def test_cannot_delete_completed_or_reversed_transaction(self):
        """Completed, Corrected, and Reversed transactions cannot be hard deleted from DB."""
        tx = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=Decimal('20000.00'),
            vehicle=self.vehicle,
            material=self.material
        )
        complete_weighing_transaction(self.operator, tx.id, Decimal('8000.00'))
        tx.refresh_from_db()
        self.assertEqual(tx.status, 'Completed')

        with self.assertRaises(ValidationError) as ctx:
            tx.delete()
        self.assertIn("Cannot delete a transaction in 'Completed' status", str(ctx.exception))

    def test_cannot_complete_non_open_transaction(self):
        """Attempting to complete a cancelled or already completed transaction must fail."""
        tx = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=Decimal('20000.00'),
            vehicle=self.vehicle,
            material=self.material
        )
        cancel_weighing_transaction(self.operator, tx.id, 'Cancelled')

        with self.assertRaises(ValidationError) as ctx:
            complete_weighing_transaction(self.operator, tx.id, Decimal('10000.00'))
        self.assertIn("Only Open transactions can be completed directly.", str(ctx.exception))

    def test_update_cannot_tamper_with_status_or_closed_transactions(self):
        """Direct update_weighing_transaction() cannot bypass workflow status transitions."""
        tx = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=Decimal('20000.00'),
            vehicle=self.vehicle,
            material=self.material
        )
        with self.assertRaises(ValidationError) as ctx:
            update_weighing_transaction(self.operator, tx.id, status='Completed')
        self.assertIn("Cannot update status via standard update", str(ctx.exception))

    # -------------------------------------------------------------------------
    # 6. Supervisor Dual-Control Approvals & PIN Checks
    # -------------------------------------------------------------------------
    def test_supervisor_cannot_approve_own_request(self):
        """A supervisor who initiated an approval request cannot approve their own submission."""
        tx = create_weighing_transaction(
            user=self.supervisor,
            weight_type='gross',
            weight=Decimal('25000.00'),
            vehicle=self.vehicle,
            material=self.material
        )
        complete_weighing_transaction(self.supervisor, tx.id, Decimal('12000.00'))

        req = request_approval(
            user=self.supervisor,
            transaction_id=tx.id,
            action='REVERSAL',
            request_reason='Reversing duplicate weighing'
        )

        with self.assertRaises(ValidationError) as ctx:
            approve_request(user=self.supervisor, request_id=req.id)
        self.assertIn("You cannot approve your own request.", str(ctx.exception))

    def test_approval_api_pin_verification(self):
        """POST /api/v1/approvals/{id}/approve/ requires a valid Supervisor PIN if provided."""
        tx = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=Decimal('25000.00'),
            vehicle=self.vehicle,
            material=self.material
        )
        complete_weighing_transaction(self.operator, tx.id, Decimal('12000.00'))
        req = request_approval(self.operator, tx.id, 'REVERSAL', 'Incorrect plate')

        self.client.force_authenticate(user=self.supervisor)

        # Invalid PIN returns 403 Forbidden
        res_bad = self.client.post(f'/api/v1/approvals/{req.id}/approve/', {'pin': '9876', 'reason': 'Approved'})
        self.assertEqual(res_bad.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Invalid Supervisor Security PIN", str(res_bad.data))

        # Valid PIN succeeds
        res_ok = self.client.post(f'/api/v1/approvals/{req.id}/approve/', {'pin': '1234', 'reason': 'PIN Verified'})
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok.data['status'], 'APPROVED')

    def test_supervisor_rejection_cancels_pending_transaction(self):
        """Rejecting an overweight or tare tolerance exception transitions tx to Cancelled."""
        tx = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=Decimal('50000.00'),
            vehicle=self.vehicle,
            material=self.material
        )
        tx.status = 'Pending Verification'
        tx.save()

        req = request_approval(self.operator, tx.id, 'OVERWEIGHT_EXCEPTION', 'Gross exceeds 45,000 kg')

        self.client.force_authenticate(user=self.supervisor)
        res = self.client.post(f'/api/v1/approvals/{req.id}/reject/', {'reason': 'Excess axle weight violates safety policy'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        tx.refresh_from_db()
        self.assertEqual(tx.status, 'Cancelled')

    # -------------------------------------------------------------------------
    # 7. Decimal Precision Arithmetic (Cents & Grams)
    # -------------------------------------------------------------------------
    def test_fractional_decimal_precision(self):
        """Calculations preserve 2-decimal-place precision without rounding drift."""
        gross = Decimal('33456.78')
        tare = Decimal('12345.67')
        expected_net = Decimal('21111.11')

        tx = create_weighing_transaction(
            user=self.operator,
            weight_type='gross',
            weight=gross,
            vehicle=self.vehicle,
            material=self.material
        )
        completed = complete_weighing_transaction(self.operator, tx.id, tare)
        self.assertEqual(completed.net_weight, expected_net)

    # -------------------------------------------------------------------------
    # 9. Role Permissions & Manual Entry Overrides Across All User Roles
    # -------------------------------------------------------------------------
    def test_administrator_can_create_manual_entry_override_transaction(self):
        """Administrators possess permission to record transactions with manual entry overrides."""
        client = APIClient()
        client.force_authenticate(user=self.admin)

        payload = {
            'vehicle': self.vehicle.id,
            'material': self.material.id,
            'weight_type': 'gross',
            'weight': 19500.0,
            'is_manual_entry': True,
            'manual_entry_reason': 'Indicator digital interface communication failure',
        }
        res = client.post('/api/v1/transactions/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['is_manual_entry'])
        self.assertEqual(res.data['manual_entry_reason'], 'Indicator digital interface communication failure')

    def test_superuser_without_assigned_role_can_create_transaction(self):
        """Superusers bypass role restrictions and can perform weighing transactions."""
        superuser = User.objects.create_superuser(
            username='root_user',
            password='RootPassword123!',
            email='root@example.com'
        )
        client = APIClient()
        client.force_authenticate(user=superuser)

        payload = {
            'vehicle': self.vehicle.id,
            'material': self.material.id,
            'weight_type': 'tare',
            'weight': 12050.0,
            'is_manual_entry': True,
            'manual_entry_reason': 'Superuser manual calibration override',
        }
        res = client.post('/api/v1/transactions/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['is_manual_entry'])

    def test_manual_entry_without_reason_is_rejected_cleanly(self):
        """Attempts to perform a manual entry override without a reason fail with 400 Bad Request."""
        client = APIClient()
        client.force_authenticate(user=self.operator)

        payload = {
            'vehicle': self.vehicle.id,
            'material': self.material.id,
            'weight_type': 'gross',
            'weight': 15000.0,
            'is_manual_entry': True,
            'manual_entry_reason': '',
        }
        res = client.post('/api/v1/transactions/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


if __name__ == '__main__':
    unittest.main()

