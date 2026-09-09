from django.contrib.auth import get_user_model
from apps.users.models import Role

User = get_user_model()

roles = ['Administrator', 'Operator', 'Supervisor', 'Manager']
for r in roles:
    Role.objects.get_or_create(name=r)

admin_role = Role.objects.get(name='Administrator')
op_role = Role.objects.get(name='Operator')
sup_role = Role.objects.get(name='Supervisor')
mgr_role = Role.objects.get(name='Manager')

if not User.objects.filter(username='admin').exists():
    admin = User.objects.create_superuser('admin', 'admin@example.com', 'admin')
    admin.role = admin_role
    admin.save()

if not User.objects.filter(username='operator').exists():
    op = User.objects.create_user('operator', 'operator@example.com', 'operator')
    op.role = op_role
    op.save()

if not User.objects.filter(username='supervisor').exists():
    sup = User.objects.create_user('supervisor', 'supervisor@example.com', 'supervisor')
    sup.role = sup_role
    sup.save()
    
print("Database seeded with roles and test users (admin/admin, operator/operator, supervisor/supervisor).")
