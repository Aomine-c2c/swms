import random
from decimal import Decimal
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.contrib.auth.hashers import make_password

from apps.users.models import User, Role
from apps.vehicles.models import Carrier, Vehicle
from apps.drivers.models import Driver
from apps.suppliers.models import Supplier
from apps.materials.models import Material
from apps.weighing.models import WeighingTransaction, ApprovalRequest
from apps.tickets.models import Ticket
from apps.audit.models import AuditLog
from apps.system.models import BackupLog, SystemSetting

try:
    from faker import Faker
except ImportError:
    print("Faker library not found. Please install it using 'pip install Faker'")
    exit(1)


class Command(BaseCommand):
    help = 'Seeds all tables with realistic mock data using Faker so every frontend tab displays data'

    def handle(self, *args, **kwargs):
        fake = Faker()
        self.stdout.write("Starting comprehensive database seeding with Faker...")

        with transaction.atomic():
            # 1. Clear existing data
            self.stdout.write("Clearing existing data...")
            ApprovalRequest.objects.all().delete()
            Ticket.objects.all().delete()
            AuditLog.objects.all().delete()
            BackupLog.objects.all().delete()
            WeighingTransaction.objects.all().delete()
            Vehicle.objects.all().delete()
            Carrier.objects.all().delete()
            Driver.objects.all().delete()
            Supplier.objects.all().delete()
            Material.objects.all().delete()
            User.objects.all().delete()
            Role.objects.all().delete()

            # 2. Roles
            self.stdout.write("Creating Roles...")
            admin_role = Role.objects.create(name='Administrator', description='System Administrator')
            supervisor_role = Role.objects.create(name='Supervisor', description='Weighbridge Operations Supervisor')
            manager_role = Role.objects.create(name='Manager', description='Plant Operations Manager')
            operator_role = Role.objects.create(name='Operator', description='Weighbridge Scale Operator')

            # 3. Users (admin/admin, supervisor/supervisor, manager/manager, operator/operator + faker users)
            self.stdout.write("Creating Users...")
            admin_user = User.objects.create(
                username='admin',
                email='admin@smart-weigh.local',
                password=make_password('admin'),
                role=admin_role,
                is_staff=True,
                is_superuser=True,
                first_name='System',
                last_name='Admin'
            )

            supervisor_user = User.objects.create(
                username='supervisor',
                email='supervisor@smart-weigh.local',
                password=make_password('supervisor'),
                role=supervisor_role,
                first_name='Sarah',
                last_name='Jenkins'
            )

            manager_user = User.objects.create(
                username='manager',
                email='manager@smart-weigh.local',
                password=make_password('manager'),
                role=manager_role,
                first_name='Marcus',
                last_name='Vance'
            )

            operator_user = User.objects.create(
                username='operator',
                email='operator@smart-weigh.local',
                password=make_password('operator'),
                role=operator_role,
                first_name='David',
                last_name='Miller'
            )

            operator1_user = User.objects.create(
                username='operator1',
                email='operator1@smart-weigh.local',
                password=make_password('password123'),
                role=operator_role,
                first_name='Operator',
                last_name='One'
            )

            supervisor1_user = User.objects.create(
                username='supervisor1',
                email='supervisor1@smart-weigh.local',
                password=make_password('password123'),
                role=supervisor_role,
                first_name='Supervisor',
                last_name='One'
            )

            operators = [operator_user, operator1_user]
            for i in range(3):
                op = User.objects.create(
                    username=f'operator_{fake.user_name()[:10]}',
                    email=fake.email(),
                    password=make_password('password123'),
                    role=operator_role,
                    first_name=fake.first_name(),
                    last_name=fake.last_name()
                )
                operators.append(op)

            supervisors = [supervisor_user, supervisor1_user]
            for _ in range(2):
                sup = User.objects.create(
                    username=f'sup_{fake.user_name()[:10]}',
                    email=fake.email(),
                    password=make_password('password123'),
                    role=supervisor_role,
                    first_name=fake.first_name(),
                    last_name=fake.last_name()
                )
                supervisors.append(sup)

            all_users = [admin_user, supervisor_user, manager_user] + operators + supervisors

            # 4. Carriers & Fleets
            self.stdout.write("Creating Carriers...")
            carriers = []
            carrier_names = [
                'Apex Freight Logistics',
                'TransContinental Haulers',
                'Titan Bulk Transport',
                'Vanguard Heavy Haulage',
                'Summit Express Lines',
                'Blue Ridge Freight Corp',
                'Ironclad Logistics Group',
                'Frontier Cargo Transport',
                'Metro Freightways Ltd',
                'Horizon Bulk Shippers'
            ]
            for c_name in carrier_names:
                carriers.append(Carrier.objects.create(
                    name=c_name,
                    contact_person=fake.name(),
                    phone_number=fake.phone_number()[:20],
                    status='Active'
                ))

            # 5. Drivers
            self.stdout.write("Creating Drivers...")
            drivers = []
            for _ in range(25):
                drivers.append(Driver.objects.create(
                    name=fake.name(),
                    license_number=fake.bothify(text='DL-########').upper(),
                    contact_info=fake.phone_number()[:20],
                    status=random.choice(['Active', 'Active', 'Active', 'Inactive'])
                ))

            # 6. Vehicles
            self.stdout.write("Creating Vehicles...")
            vehicles = []
            vehicle_types = ['Tri-Axle Tipper', 'Semi-Trailer', 'Flatbed Hauler', 'Bulk Dump Truck', 'Twin-Trailer B-Double']
            plate_prefixes = ['CA', 'TX', 'NY', 'FL', 'IL', 'OH', 'PA', 'MI']
            for i in range(25):
                plate = f"{random.choice(plate_prefixes)}-{random.randint(100, 999)}-{fake.lexify(text='??').upper()}"
                v_carrier = random.choice(carriers) if random.random() > 0.15 else None
                v_driver = random.choice(drivers) if random.random() > 0.2 else None
                known_tare = Decimal(random.randint(9000, 16000))
                max_cap = Decimal(random.randint(40000, 60000))
                
                v = Vehicle.objects.create(
                    license_plate=plate,
                    vehicle_type=random.choice(vehicle_types),
                    known_tare_weight=known_tare,
                    carrier=v_carrier,
                    default_driver=v_driver,
                    max_capacity=max_cap,
                    tare_tolerance_pct=Decimal('5.00'),
                    tare_tolerance_kg=Decimal('250.00'),
                    registration_expiry=timezone.now().date() + timedelta(days=random.randint(30, 400)),
                    last_inspection_date=timezone.now().date() - timedelta(days=random.randint(10, 180)),
                    status='Active'
                )
                vehicles.append(v)

            # 7. Suppliers
            self.stdout.write("Creating Suppliers...")
            suppliers = []
            supplier_names = [
                'Pinnacle Quarry Resources',
                'Midwest Aggregate Supply',
                'Vulcan Mineral Processing',
                'Highland Sand & Gravel Co.',
                'Red River Cement & Lime',
                'Great Lakes Industrial Scrap',
                'Southern Timber & Wood Chips',
                'Apex Asphalt & Paving Materials',
                'Sterling Coal & Carbon Corp',
                'Keystone Mineral Extraction'
            ]
            for s_name in supplier_names:
                suppliers.append(Supplier.objects.create(
                    name=s_name,
                    contact_person=fake.name(),
                    address=fake.address().replace('\n', ', '),
                    status='Active'
                ))

            # 8. Materials
            self.stdout.write("Creating Materials...")
            materials = []
            material_specs = [
                ('Granite Aggregate 20mm', 'Crushed hard stone for heavy structural concrete', Decimal('38.50')),
                ('Washed Concrete Sand', 'Triple-washed fine aggregate conforming to ASTM C33', Decimal('24.00')),
                ('Type I/II Portland Cement', 'High-strength general civil construction binder', Decimal('115.00')),
                ('Industrial Crushed Limestone', 'Processed high-calcium flux stone', Decimal('32.00')),
                ('Bituminous Coal Grade A', 'High-BTU industrial boiler fuel grade', Decimal('85.00')),
                ('Heavy Melting Scrap (HMS 1/2)', 'Ferrous structural cut steel scrap', Decimal('280.00')),
                ('Hardwood Biomass Wood Chips', 'Dried organic thermal generation grade', Decimal('18.50')),
                ('Screened Topsoil Premium', 'Loamy organic landscape fill soil', Decimal('22.00')),
                ('Bentonite Clay Industrial', 'High-plasticity mineral sealing clay', Decimal('64.00')),
                ('Hot Mix Asphalt (Surface Course)', 'Bituminous asphalt binder paving blend', Decimal('76.00')),
            ]
            for name, desc, price in material_specs:
                materials.append(Material.objects.create(
                    name=name,
                    description=desc,
                    unit_price=price,
                    status='Active'
                ))

            # 9. Weighing Transactions (Rich dataset with varying states and dates)
            self.stdout.write("Creating Weighing Transactions...")
            now = timezone.now()
            transactions = []

            # Historical completed transactions (last 30 days)
            for _ in range(60):
                v = random.choice(vehicles)
                d = v.default_driver or random.choice(drivers)
                s = random.choice(suppliers)
                m = random.choice(materials)
                op = random.choice(operators)

                tare = v.known_tare_weight if random.random() > 0.15 else Decimal(random.randint(9000, 16000))
                net = Decimal(random.randint(12000, 32000))
                gross = tare + net

                first_time = now - timedelta(
                    days=random.randint(0, 28),
                    hours=random.randint(0, 23),
                    minutes=random.randint(0, 59)
                )
                second_time = first_time + timedelta(minutes=random.randint(12, 95))

                tx = WeighingTransaction(
                    vehicle=v,
                    driver=d,
                    supplier=s,
                    material=m,
                    operator=op,
                    gross_weight=gross,
                    tare_weight=tare,
                    net_weight=net,
                    first_weighing_datetime=first_time,
                    second_weighing_datetime=second_time,
                    status='Completed',
                    remarks=fake.sentence(nb_words=6) if random.random() > 0.6 else None
                )
                tx.save()
                transactions.append(tx)

            # Open Inbound/Outbound Transactions
            for _ in range(6):
                v = random.choice(vehicles)
                d = v.default_driver or random.choice(drivers)
                s = random.choice(suppliers)
                m = random.choice(materials)
                op = random.choice(operators)
                first_time = now - timedelta(minutes=random.randint(8, 75))

                tx = WeighingTransaction(
                    vehicle=v,
                    driver=d,
                    supplier=s,
                    material=m,
                    operator=op,
                    first_weighing_datetime=first_time,
                    status='Open'
                )
                if random.random() > 0.5:
                    tx.gross_weight = Decimal(random.randint(28000, 48000))
                else:
                    tx.tare_weight = v.known_tare_weight or Decimal(random.randint(9000, 15000))
                tx.save()
                transactions.append(tx)

            # Pending Verification Transactions (overweight or tare deviations)
            for _ in range(4):
                v = random.choice(vehicles)
                d = v.default_driver or random.choice(drivers)
                s = random.choice(suppliers)
                m = random.choice(materials)
                op = random.choice(operators)
                first_time = now - timedelta(hours=random.randint(1, 10))

                tare = (v.known_tare_weight or Decimal('12000')) + Decimal(random.randint(800, 1500))
                gross = (v.max_capacity or Decimal('45000')) + Decimal(random.randint(1200, 3500))
                net = gross - tare

                tx = WeighingTransaction(
                    vehicle=v,
                    driver=d,
                    supplier=s,
                    material=m,
                    operator=op,
                    gross_weight=gross,
                    tare_weight=tare,
                    net_weight=net,
                    first_weighing_datetime=first_time,
                    second_weighing_datetime=first_time + timedelta(minutes=30),
                    status='Pending Verification',
                    remarks='Weight breach detected: awaiting supervisor verification.'
                )
                tx.save()
                transactions.append(tx)

            # Corrected Transactions
            for _ in range(3):
                v = random.choice(vehicles)
                tx = WeighingTransaction(
                    vehicle=v,
                    driver=random.choice(drivers),
                    supplier=random.choice(suppliers),
                    material=random.choice(materials),
                    operator=random.choice(operators),
                    gross_weight=Decimal('39500.00'),
                    tare_weight=Decimal('12500.00'),
                    net_weight=Decimal('27000.00'),
                    first_weighing_datetime=now - timedelta(days=random.randint(2, 10)),
                    second_weighing_datetime=now - timedelta(days=random.randint(2, 10), minutes=-45),
                    status='Corrected',
                    remarks='Corrected per supervisor authorization.'
                )
                tx.save()
                transactions.append(tx)

            # Reversed Transactions
            for _ in range(2):
                v = random.choice(vehicles)
                tx = WeighingTransaction(
                    vehicle=v,
                    driver=random.choice(drivers),
                    supplier=random.choice(suppliers),
                    material=random.choice(materials),
                    operator=random.choice(operators),
                    gross_weight=Decimal('36000.00'),
                    tare_weight=Decimal('13000.00'),
                    net_weight=Decimal('23000.00'),
                    first_weighing_datetime=now - timedelta(days=random.randint(3, 14)),
                    second_weighing_datetime=now - timedelta(days=random.randint(3, 14), minutes=-20),
                    status='Reversed',
                    remarks='Driver entered incorrect weighbridge bay, transaction reversed.'
                )
                tx.save()
                transactions.append(tx)

            # 10. Tickets (Ensure every completed and corrected transaction has an official ticket)
            self.stdout.write("Generating Weighbridge Tickets...")
            completed_txs = WeighingTransaction.objects.filter(status__in=['Completed', 'Corrected'])
            for tx in completed_txs:
                date_str = tx.first_weighing_datetime.strftime('%Y%m%d')
                rand_code = fake.lexify(text='??????').upper()
                ticket_no = f"TKT-{date_str}-{rand_code}"
                Ticket.objects.create(
                    transaction=tx,
                    ticket_number=ticket_no,
                    printed_by=random.choice(operators),
                    print_count=random.choice([1, 1, 1, 2, 3])
                )

            # 11. Approvals Queue (Pending, Approved, Rejected)
            self.stdout.write("Creating Approval Requests...")
            # Pending approvals for the pending verification transactions
            pending_txs = WeighingTransaction.objects.filter(status='Pending Verification')
            action_types = ['OVERWEIGHT_EXCEPTION', 'TARE_TOLERANCE_EXCEPTION', 'CORRECTION', 'REVERSAL']
            
            for idx, p_tx in enumerate(pending_txs):
                action = action_types[idx % len(action_types)]
                changes = None
                if action == 'CORRECTION':
                    changes = {'gross_weight': float(p_tx.gross_weight or 35000) - 1000}
                
                ApprovalRequest.objects.create(
                    transaction=p_tx,
                    action=action,
                    status='PENDING',
                    requested_by=p_tx.operator,
                    request_reason=fake.sentence(nb_words=8),
                    changes_payload=changes
                )

            # Also create some historical APPROVED and REJECTED approval requests
            approved_txs = completed_txs[:4]
            for idx, a_tx in enumerate(approved_txs):
                ApprovalRequest.objects.create(
                    transaction=a_tx,
                    action=random.choice(['CORRECTION', 'TARE_TOLERANCE_EXCEPTION', 'OVERWEIGHT_EXCEPTION']),
                    status='APPROVED',
                    requested_by=a_tx.operator,
                    reviewed_by=supervisor_user,
                    request_reason='Tare deviation inspected on scale platform, approved entry.',
                    review_reason='Verified visual axle condition. Tare variance within secondary tolerance.',
                    changes_payload={'notes': 'Approved by Shift Supervisor'}
                )

            rejected_txs = completed_txs[4:7]
            for idx, r_tx in enumerate(rejected_txs):
                ApprovalRequest.objects.create(
                    transaction=r_tx,
                    action='REVERSAL',
                    status='REJECTED',
                    requested_by=r_tx.operator,
                    reviewed_by=supervisor_user,
                    request_reason='Operator requested ticket void due to incorrect material assignment.',
                    review_reason='Discharge already unloaded at stockpile B. Reversal disallowed per SOP.'
                )

            # 12. Audit Trail Logs
            self.stdout.write("Generating Audit Trail Logs...")
            audit_actions = [
                ('CREATE', 'WeighingTransaction', 'Transaction initiated on scale platform'),
                ('COMPLETE', 'WeighingTransaction', 'Second weighing captured and transaction finalized'),
                ('TICKET_GENERATE', 'Ticket', 'Official weighbridge weight certificate generated'),
                ('TICKET_REPRINT', 'Ticket', 'Duplicate weighbridge ticket printed by operator'),
                ('CORRECT', 'WeighingTransaction', 'Gross weight corrected upon supervisor approval'),
                ('APPROVE', 'ApprovalRequest', 'Overload tolerance exception approved by supervisor'),
                ('LOGIN', 'User', 'User authenticated successfully to terminal console'),
                ('UPDATE', 'SystemSetting', 'Updated global tare deviation tolerance thresholds')
            ]

            sample_tx_ids = [t.id for t in completed_txs[:15]]
            for i in range(45):
                act, rec_type, reason = random.choice(audit_actions)
                user = random.choice(all_users)
                rec_id = str(random.choice(sample_tx_ids)) if rec_type == 'WeighingTransaction' else str(random.randint(1, 20))
                
                AuditLog.objects.create(
                    user=user,
                    action=act,
                    record_type=rec_type,
                    record_id=rec_id,
                    previous_value={'status': 'Open'} if act in ['COMPLETE', 'CORRECT'] else None,
                    new_value={'status': 'Completed'} if act in ['COMPLETE', 'CORRECT'] else {'event': act},
                    reason=reason,
                    action_datetime=now - timedelta(days=random.randint(0, 14), hours=random.randint(0, 23))
                )

            # 13. System Backup Logs
            self.stdout.write("Generating Backup Logs...")
            backup_statuses = ['VERIFIED', 'VERIFIED', 'SUCCESS', 'FAILED']
            for i in range(8):
                b_status = random.choice(backup_statuses)
                started = now - timedelta(days=i * 2 + 1, hours=random.randint(1, 6))
                completed = started + timedelta(seconds=random.randint(15, 60))
                file_size = random.randint(12000000, 28000000)
                
                BackupLog.objects.create(
                    started_at=started,
                    completed_at=completed,
                    status=b_status,
                    engine='sqlite',
                    triggered_by='SCHEDULED' if i > 1 else 'MANUAL',
                    triggered_by_user=admin_user if i <= 1 else None,
                    backup_filename=f"swms_backup_{started.strftime('%Y%m%d_%H%M%S')}.sqlite3.gz",
                    file_size_bytes=file_size,
                    checksum_sha256=fake.sha256(),
                    verification_status='PASSED' if b_status in ['VERIFIED', 'SUCCESS'] else ('FAILED' if b_status == 'FAILED' else ''),
                    verification_message='Database schema integrity check completed with 0 errors.' if b_status in ['VERIFIED', 'SUCCESS'] else 'Integrity check checksum mismatch on archive unpack.',
                    retention_policy_applied=True,
                    files_pruned=random.randint(0, 2),
                    error_message='Integrity check error' if b_status == 'FAILED' else ''
                )

            # 14. System Settings (Singleton)
            self.stdout.write("Configuring System Settings...")
            setting = SystemSetting.get_settings()
            setting.tare_tolerance_pct = Decimal('5.00')
            setting.tare_tolerance_kg = Decimal('250.00')
            setting.tare_tolerance_mode = 'EITHER'
            setting.overweight_enforcement_enabled = True
            setting.save()

        self.stdout.write(self.style.SUCCESS('Successfully seeded comprehensive Faker dataset across ALL modules!'))
