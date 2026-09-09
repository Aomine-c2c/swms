from django.contrib import admin
from .models import Vehicle, Carrier

@admin.register(Carrier)
class CarrierAdmin(admin.ModelAdmin):
    list_display = ('name', 'contact_person', 'phone_number', 'status', 'created_at')
    search_fields = ('name',)
    list_filter = ('status',)

@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('license_plate', 'vehicle_type', 'carrier', 'default_driver', 'known_tare_weight', 'max_capacity', 'status')
    search_fields = ('license_plate', 'vehicle_type')
    list_filter = ('status', 'carrier')
