from rest_framework import serializers
from apps.vehicles.models import Vehicle, Carrier
from apps.drivers.models import Driver
from apps.suppliers.models import Supplier
from apps.materials.models import Material

class CarrierSerializer(serializers.ModelSerializer):
    vehicle_count = serializers.IntegerField(source='vehicles.count', read_only=True)

    class Meta:
        model = Carrier
        fields = '__all__'

class VehicleSerializer(serializers.ModelSerializer):
    carrier_name = serializers.CharField(source='carrier.name', read_only=True)
    default_driver_name = serializers.CharField(source='default_driver.name', read_only=True)

    class Meta:
        model = Vehicle
        fields = '__all__'

class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = '__all__'

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = '__all__'
