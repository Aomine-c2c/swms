from django.contrib.auth.models import AbstractUser
from django.db import models
from apps.core.models import TimeStampedModel

class Role(TimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class User(AbstractUser):
    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    )
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.username
