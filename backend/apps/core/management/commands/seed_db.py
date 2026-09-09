import random
from decimal import Decimal
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.contrib.auth.hashers import make_password

from apps.users.models import User, Role
from apps.vehicles.models import Vehicle
from apps.drivers.models import Driver
from apps.suppliers.models import Supplier
from apps.materials.models import Material
from apps.weighing.models import WeighingTransaction

try:
    from faker import Faker
except ImportError:
    print("Faker library not found. Please install it using 'pip install Faker'")
    exit(1)

class Command(BaseCommand):
    help = 'Seeds the database with realistic mock data for Smart-Weigh'

    def handle(self, *args, **kwargs):
        fake = Faker()
        
        self.stdout.write("Starting database seed process...")

        with transaction.atomic():
            # 1. Clear existing data
            self.stdout.write("Clearing existing data...")
            WeighingTransaction.objects.all().delete()
            Vehicle.objects.all().delete()
            Driver.objects.all().delete()
            Supplier.objects.all().delete()
            Material.objects.all().delete()
            User.objects.all().delete()
            Role.objects.all().delete()

            # 2. Create Roles
            self.stdout.write("Creating Roles and Users...")
            admin_role = Role.objects.create(name='Administrator', description='System Administrator')
            supervisor_role = Role.objects.create(name='Supervisor', description='Weighbridge Supervisor')
            operator_role = Role.objects.create(name='Operator', description='Weighbridge Operator')

            # 3. Create Users
            users = []
            
            # Default Admin
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
            users.append(admin_user)

            # Supervisors
            for i in range(2):
                users.append(User.objects.create(
                    username=f'supervisor{i+1}',
                    email=fake.email(),
                    password=make_password('password123'),
                    role=supervisor_role,
                    first_name=fake.first_name(),
                    last_name=fake.last_name()
                ))

            # Operators
            operators = []
            for i in range(5):
                op = User.objects.create(
                    username=f'operator{i+1}',
                    email=fake.email(),
                    password=make_password('password123'),
                    role=operator_role,
                    first_name=fake.first_name(),
                    last_name=fake.last_name()
                )
                users.append(op)
                operators.append(op)

            # 4. Master Data
            self.stdout.write("Creating Master Data...")
            
            # Vehicles
            vehicles = []
            vehicle_types = ['Truck', 'Trailer', 'Van', 'Tipper']
            for _ in range(20):
                vehicles.append(Vehicle.objects.create(
                    license_plate=fake.license_plate().replace(" ", "").upper()[:15],
                    vehicle_type=random.choice(vehicle_types),
                    known_tare_weight=Decimal(random.randint(5000, 15000)),
                    status='Active'
                ))

            # Drivers
            drivers = []
            for _ in range(20):
                drivers.append(Driver.objects.create(
                    name=fake.name(),
                    license_number=fake.bothify(text='??#######').upper(),
                    contact_info=fake.phone_number()[:20],
                    status='Active'
                ))

            # Suppliers
            suppliers = []
            for _ in range(10):
                suppliers.append(Supplier.objects.create(
                    name=fake.company(),
                    contact_person=fake.name(),
                    address=fake.address().replace('\n', ', '),
                    status='Active'
                ))

            # Materials
            materials = []
            material_names = ['Sand', 'Gravel', 'Cement', 'Limestone', 'Coal', 'Steel Scrap', 'Wood Chips', 'Topsoil', 'Clay', 'Asphalt']
            for name in material_names:
                materials.append(Material.objects.create(
                    name=name,
                    description=fake.catch_phrase(),
                    unit_price=Decimal(random.uniform(10.0, 150.0)).quantize(Decimal('0.01')),
                    status='Active'
                ))

            # 5. Transactions
            self.stdout.write("Creating Transactions...")
            
            now = timezone.now()
            
            # Completed Transactions (Historical)
            for _ in range(50):
                v = random.choice(vehicles)
                tare = v.known_tare_weight if random.random() > 0.2 else Decimal(random.randint(5000, 15000))
                gross = tare + Decimal(random.randint(2000, 30000))
                net = gross - tare
                
                # Random time in the last 30 days
                first_weigh_time = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23), minutes=random.randint(0, 59))
                second_weigh_time = first_weigh_time + timedelta(minutes=random.randint(15, 120))
                
                WeighingTransaction.objects.create(
                    vehicle=v,
                    driver=random.choice(drivers) if random.random() > 0.3 else None,
                    supplier=random.choice(suppliers) if random.random() > 0.2 else None,
                    material=random.choice(materials),
                    operator=random.choice(operators),
                    gross_weight=gross,
                    tare_weight=tare,
                    net_weight=net,
                    first_weighing_datetime=first_weigh_time,
                    second_weighing_datetime=second_weigh_time,
                    status='Completed'
                )
                
            # Open Transactions (Active inbound)
            for _ in range(5):
                v = random.choice(vehicles)
                is_tare_first = random.choice([True, False])
                
                first_weigh_time = now - timedelta(minutes=random.randint(5, 60))
                
                tx = WeighingTransaction(
                    vehicle=v,
                    driver=random.choice(drivers) if random.random() > 0.3 else None,
                    supplier=random.choice(suppliers) if random.random() > 0.2 else None,
                    material=random.choice(materials),
                    operator=random.choice(operators),
                    first_weighing_datetime=first_weigh_time,
                    status='Open'
                )
                
                if is_tare_first:
                    tx.tare_weight = v.known_tare_weight if random.random() > 0.5 else Decimal(random.randint(5000, 15000))
                else:
                    # gross first
                    tx.gross_weight = Decimal(random.randint(15000, 45000))
                    
                tx.save()

        self.stdout.write(self.style.SUCCESS('Successfully seeded database with realistic mock data.'))
