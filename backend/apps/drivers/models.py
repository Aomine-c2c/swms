from django.db import models
from apps.core.models import TimeStampedModel

class Driver(TimeStampedModel):
    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    )
    name = models.CharField(max_length=255)
    license_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    contact_info = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')

    def __str__(self):
        return self.name
