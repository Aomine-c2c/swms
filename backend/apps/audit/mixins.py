from rest_framework import mixins
from apps.audit.services import log_audit_action

class AuditMixin:
    """
    Mixin for ViewSets to automatically log CREATE, UPDATE, and DELETE actions
    along with previous and new serialized states.
    """
    
    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit_action(
            self.request.user, 
            'CREATE', 
            instance.__class__.__name__, 
            instance.id,
            new_value=serializer.data
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        # Get previous state
        old_serializer = self.get_serializer(instance)
        previous_value = old_serializer.data
        
        # Save new state
        instance = serializer.save()
        new_value = serializer.data
        
        log_audit_action(
            self.request.user, 
            'UPDATE', 
            instance.__class__.__name__, 
            instance.id,
            previous_value=previous_value,
            new_value=new_value
        )

    def perform_destroy(self, instance):
        old_serializer = self.get_serializer(instance)
        previous_value = old_serializer.data
        
        record_type = instance.__class__.__name__
        record_id = instance.id
        
        # We perform destroy, though in our system many are soft deletes.
        # This will be called if the view actually deletes or if it overrides it.
        super().perform_destroy(instance)
        
        log_audit_action(
            self.request.user, 
            'DELETE', 
            record_type, 
            record_id,
            previous_value=previous_value
        )
