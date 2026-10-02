from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from apps.vehicles.models import Vehicle, Carrier
from apps.drivers.models import Driver
from apps.suppliers.models import Supplier
from apps.materials.models import Material
from apps.core.serializers import VehicleSerializer, DriverSerializer, SupplierSerializer, MaterialSerializer, CarrierSerializer
from apps.core.permissions import HasPermission
from apps.audit.mixins import AuditMixin

class MasterDataViewSet(AuditMixin, viewsets.ModelViewSet):
    """Base ViewSet for master data with common filters and permissions."""
    permission_classes = [IsAuthenticated] # Read allowed for all authed, write requires Manager/Admin
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status']
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), HasPermission('manage_master_records')()]
        return super().get_permissions()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Capture old state for audit
        old_serializer = self.get_serializer(instance)
        previous_value = old_serializer.data
        
        instance.status = 'Inactive'
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

class CarrierViewSet(MasterDataViewSet):
    queryset = Carrier.objects.all().order_by('name')
    serializer_class = CarrierSerializer
    search_fields = ['name', 'contact_person']

class VehicleViewSet(MasterDataViewSet):
    queryset = Vehicle.objects.all().order_by('license_plate')
    serializer_class = VehicleSerializer
    search_fields = ['license_plate', 'vehicle_type']
    filterset_fields = ['status', 'carrier']

class DriverViewSet(MasterDataViewSet):
    queryset = Driver.objects.all().order_by('name')
    serializer_class = DriverSerializer
    search_fields = ['name', 'license_number']

class SupplierViewSet(MasterDataViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    search_fields = ['name', 'contact_person']

class MaterialViewSet(MasterDataViewSet):
    queryset = Material.objects.all().order_by('name')
    serializer_class = MaterialSerializer
    search_fields = ['name', 'description']

from rest_framework.views import APIView
from apps.weighing.models import WeighingTransaction

class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({
                "transactions": [],
                "vehicles": [],
                "materials": [],
                "suppliers": [],
                "drivers": []
            })
            
        # Fast icontains queries across models
        transactions = WeighingTransaction.objects.filter(ticket__ticket_number__icontains=query).values('id', 'ticket__ticket_number')[:5]
        vehicles = Vehicle.objects.filter(license_plate__icontains=query).values('id', 'license_plate')[:5]
        materials = Material.objects.filter(name__icontains=query).values('id', 'name')[:5]
        suppliers = Supplier.objects.filter(name__icontains=query).values('id', 'name')[:5]
        drivers = Driver.objects.filter(name__icontains=query).values('id', 'name')[:5]

        return Response({
            "transactions": [{"id": t['id'], "label": t['ticket__ticket_number']} for t in transactions if t['ticket__ticket_number']],
            "vehicles": [{"id": v['id'], "label": v['license_plate']} for v in vehicles],
            "materials": [{"id": m['id'], "label": m['name']} for m in materials],
            "suppliers": [{"id": s['id'], "label": s['name']} for s in suppliers],
            "drivers": [{"id": d['id'], "label": d['name']} for d in drivers]
        })
