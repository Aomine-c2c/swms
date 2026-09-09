import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'smart_weigh.settings')
django.setup()

from apps.weighing.approval_services import request_approval
from apps.weighing.models import WeighingTransaction
from django.contrib.auth import get_user_model

User = get_user_model()
operator = User.objects.filter(username='operator').first()

if not operator:
    operator = User.objects.create_user('operator', 'operator@example.com', 'operator')

# Check if there are transactions
tx = WeighingTransaction.objects.first()

if not tx:
    from apps.vehicles.models import Vehicle
    from apps.materials.models import Material
    from django.utils import timezone
    
    vehicle, _ = Vehicle.objects.get_or_create(license_plate='XYZ-999')
    material, _ = Material.objects.get_or_create(code='MAT-01', name='Coal')
    
    tx = WeighingTransaction.objects.create(
        vehicle=vehicle,
        material=material,
        operator=operator,
        gross_weight=45000,
        tare_weight=15000,
        first_weighing_datetime=timezone.now(),
        second_weighing_datetime=timezone.now(),
        status='Completed'
    )
    
# Create pending approval requests using the service function to ensure all logic is followed
try:
    request_approval(
        user=operator,
        transaction_id=tx.id,
        action='CORRECTION',
        request_reason='Entered wrong gross weight initially.',
        changes_payload={'gross_weight': 40000}
    )
    print("Created CORRECTION request.")
except Exception as e:
    print(f"Error creating CORRECTION: {e}")

try:
    # Need a second transaction for reversal to not conflict with the first pending request
    from django.utils import timezone
    tx2 = WeighingTransaction.objects.create(
        vehicle=tx.vehicle,
        material=tx.material,
        operator=operator,
        gross_weight=35000,
        tare_weight=15000,
        first_weighing_datetime=timezone.now(),
        status='Completed'
    )
    request_approval(
        user=operator,
        transaction_id=tx2.id,
        action='REVERSAL',
        request_reason='Vehicle details mismatched, need to reverse.'
    )
    print("Created REVERSAL request.")
except Exception as e:
    print(f"Error creating REVERSAL: {e}")

print("Approval requests generation complete.")
