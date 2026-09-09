from django.db import models
from apps.core.models import TimeStampedModel

class Carrier(TimeStampedModel):
    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    )
    name = models.CharField(max_length=255, unique=True)
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')

    def __str__(self):
        return self.name

class Vehicle(TimeStampedModel):
    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    )
    license_plate = models.CharField(max_length=20, unique=True)
    vehicle_type = models.CharField(max_length=100, blank=True, null=True)
    known_tare_weight = models.DecimalField(max_length=10, max_digits=10, decimal_places=2, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    
    carrier = models.ForeignKey(Carrier, on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicles')
    default_driver = models.ForeignKey('drivers.Driver', on_delete=models.SET_NULL, null=True, blank=True, related_name='default_vehicles')
    max_capacity = models.DecimalField(max_length=10, max_digits=10, decimal_places=2, blank=True, null=True, help_text="Maximum gross weight capacity in kg")
    registration_expiry = models.DateField(blank=True, null=True)
    last_inspection_date = models.DateField(blank=True, null=True)

    def __str__(self):
        return self.license_plate
