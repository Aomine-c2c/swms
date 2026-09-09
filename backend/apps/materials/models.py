from django.db import models
from apps.core.models import TimeStampedModel

class Material(TimeStampedModel):
    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    )
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')

    def __str__(self):
        return self.name
