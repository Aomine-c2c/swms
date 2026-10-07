from rest_framework import permissions

ROLE_PERMISSIONS = {
    'Administrator': [
        'manage_users', 
        'manage_roles', 
        'manage_master_records', 
        'view_audit_logs', 
        'manage_system_settings',
        'manage_system',
        'manage_hardware',
        'generate_reports',
        'register_vehicles', 
        'register_drivers', 
        'capture_weights', 
        'create_transactions', 
        'view_transactions', 
        'generate_tickets',
        'approve_corrections', 
        'approve_reversals', 
        'investigate_exceptions', 
        'view_dashboards', 
        'monitor_performance'
    ],
    'Operator': [
        'register_vehicles', 
        'register_drivers', 
        'capture_weights', 
        'create_transactions', 
        'view_transactions', 
        'generate_tickets'
    ],
    'Weighbridge Operator': [
        'register_vehicles', 
        'register_drivers', 
        'capture_weights', 
        'create_transactions', 
        'view_transactions', 
        'generate_tickets'
    ],
    'Supervisor': [
        'capture_weights',
        'create_transactions',
        'view_transactions', 
        'approve_corrections', 
        'approve_reversals', 
        'investigate_exceptions', 
        'generate_reports', 
        'view_audit_logs'
    ],
    'Manager': [
        'view_dashboards', 
        'view_transactions', 
        'generate_reports', 
        'monitor_performance'
    ]
}

def get_user_permissions(user):
    if not user or not user.is_authenticated:
        return []
    if getattr(user, 'is_superuser', False):
        # Superuser has all defined permissions
        all_perms = set()
        for perms in ROLE_PERMISSIONS.values():
            all_perms.update(perms)
        return list(all_perms)
    if not getattr(user, 'role', None):
        return []
    return ROLE_PERMISSIONS.get(user.role.name, [])

def HasPermission(required_permission):
    """
    Factory function that returns a BasePermission class 
    which checks if the user's role has the required_permission.
    """
    class _HasPermission(permissions.BasePermission):
        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            if getattr(request.user, 'is_superuser', False):
                return True
            if not getattr(request.user, 'role', None):
                return False
            
            user_perms = ROLE_PERMISSIONS.get(request.user.role.name, [])
            return required_permission in user_perms
            
    return _HasPermission

# Retain old classes temporarily if some views still use them before they are fully migrated
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return 'manage_system_settings' in get_user_permissions(request.user)

class IsManagerRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return 'view_dashboards' in get_user_permissions(request.user)

class IsManagerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        perms = get_user_permissions(request.user)
        return 'manage_system_settings' in perms or 'view_dashboards' in perms or 'approve_corrections' in perms

class IsOperatorRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return 'capture_weights' in get_user_permissions(request.user)
