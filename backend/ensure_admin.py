import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'smart_weigh.settings')
django.setup()

from apps.users.models import User, Role

def ensure_default_admin():
    admin_role, _ = Role.objects.get_or_create(
        name='Administrator',
        defaults={'description': 'System Administrator'}
    )
    # Also ensure standard roles exist
    Role.objects.get_or_create(name='Supervisor', defaults={'description': 'Weighbridge Operations Supervisor'})
    Role.objects.get_or_create(name='Manager', defaults={'description': 'Plant Operations Manager'})
    Role.objects.get_or_create(name='Operator', defaults={'description': 'Weighbridge Scale Operator'})

    user, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@swms.local',
            'role': admin_role,
            'is_staff': True,
            'is_superuser': True,
            'status': 'Active',
            'first_name': 'System',
            'last_name': 'Administrator',
        }
    )
    user.set_password('admin123')
    user.role = admin_role
    user.is_staff = True
    user.is_superuser = True
    user.status = 'Active'
    user.save()
    if created:
        print("[Auth] Created default administrator: admin / admin123")
    else:
        print("[Auth] Verified default administrator: admin / admin123")

    # Also ensure Devine_General exists
    devine_user, d_created = User.objects.get_or_create(
        username='Devine_General',
        defaults={
            'email': 'devine.general@swms.local',
            'role': admin_role,
            'is_staff': True,
            'is_superuser': True,
            'status': 'Active',
            'first_name': 'Devine',
            'last_name': 'General',
        }
    )
    devine_user.set_password('password123')
    devine_user.role = admin_role
    devine_user.is_staff = True
    devine_user.is_superuser = True
    devine_user.status = 'Active'
    devine_user.save()
    if d_created:
        print("[Auth] Created admin user: Devine_General / password123")

if __name__ == '__main__':
    ensure_default_admin()
