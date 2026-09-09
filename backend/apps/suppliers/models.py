from django.db import models
from apps.core.models import TimeStampedModel

class Supplier(TimeStampedModel):
    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    )
    name = models.CharField(max_length=255, unique=True)
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')

    def __str__(self):
        return self.name
