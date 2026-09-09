from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from apps.users.models import User, Role
from apps.users.serializers import UserSerializer, RoleSerializer
from apps.core.permissions import HasPermission
from django_filters.rest_framework import DjangoFilterBackend
from apps.users.serializers import UserSerializer, RoleSerializer
from apps.core.permissions import HasPermission
from apps.audit.mixins import AuditMixin
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

class RoleViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = Role.objects.all().order_by('name')
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasPermission('manage_roles')]

class UserViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = User.objects.select_related('role').all().order_by('id')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, HasPermission('manage_users')]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status', 'is_active', 'role']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        old_serializer = self.get_serializer(instance)
        previous_value = old_serializer.data
        
        instance.status = 'Inactive'
        instance.is_active = False
        instance.save()
        
        from apps.audit.services import log_audit_action
        log_audit_action(
            request.user, 
            'DELETE', 
            instance.__class__.__name__, 
            instance.id,
            previous_value=previous_value
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [AnonRateThrottle]
    
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        try:
            response = super().post(request, *args, **kwargs)
            # Find user
            try:
                user = User.objects.get(username=username)
                from apps.audit.services import log_audit_action
                log_audit_action(user, 'LOGIN', 'User', user.id, new_value={'ip': request.META.get('REMOTE_ADDR')})
            except User.DoesNotExist:
                pass
            return response
        except Exception as e:
            from apps.audit.services import log_audit_action
            log_audit_action(None, 'LOGIN_FAILED', 'System', 'Login', new_value={'username': username, 'ip': request.META.get('REMOTE_ADDR')})
            raise e

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        from apps.audit.services import log_audit_action
        log_audit_action(request.user, 'LOGOUT', 'User', request.user.id)
        return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
