import os
import django
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "smart_weigh.settings")
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

print("USERS AND ROLES:")
for u in User.objects.all():
    role_name = u.role.name if getattr(u, 'role', None) else None
    print(f"- {u.username}: {role_name}")

print("\nROLE PERMISSIONS DEFINITION:")
from apps.core.permissions import ROLE_PERMISSIONS
for r, p in ROLE_PERMISSIONS.items():
    print(f"- {r}: {len(p)} perms")
