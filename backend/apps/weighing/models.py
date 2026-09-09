from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings
from apps.core.models import TimeStampedModel
from apps.vehicles.models import Vehicle
from apps.drivers.models import Driver
from apps.suppliers.models import Supplier
from apps.materials.models import Material

class WeighingTransaction(TimeStampedModel):
    STATUS_CHOICES = (
        ('Open', 'Open'),
        ('Pending Verification', 'Pending Verification'),
        ('Completed', 'Completed'),
        ('Corrected', 'Corrected'),
        ('Reversed', 'Reversed'),
        ('Cancelled', 'Cancelled'),
    )
    
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name='transactions')
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, null=True, blank=True, related_name='transactions')
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='transactions')
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='transactions')
    
    gross_weight = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    tare_weight = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    net_weight = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    first_weighing_datetime = models.DateTimeField(db_index=True)
    second_weighing_datetime = models.DateTimeField(null=True, blank=True)
    
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Open', db_index=True)
    remarks = models.TextField(null=True, blank=True)

    is_manual_entry = models.BooleanField(default=False)
    manual_entry_reason = models.CharField(max_length=255, null=True, blank=True)

    def clean(self):
        if self.is_manual_entry and not self.manual_entry_reason:
            raise ValidationError("A reason must be provided for manual weight entries.")

        if self.gross_weight is not None and self.tare_weight is not None:
            if self.tare_weight > self.gross_weight:
                raise ValidationError("Tare weight cannot be greater than gross weight.")
            expected_net = self.gross_weight - self.tare_weight
            self.net_weight = expected_net

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status in ['Completed', 'Corrected', 'Reversed']:
            raise ValidationError(f"Cannot delete a transaction in '{self.status}' status. Use correction or reversal instead.")
        super().delete(*args, **kwargs)

    class Meta:
        indexes = [
            # For operator dashboard: filter by operator + status
            models.Index(fields=['operator', 'status'], name='tx_operator_status_idx'),
            # For reports: date range queries on completed transactions
            models.Index(fields=['status', 'first_weighing_datetime'], name='tx_status_date_idx'),
            # For supervisor dashboard: recent exceptions sorted by updated_at
            models.Index(fields=['updated_at'], name='tx_updated_at_idx'),
        ]

    def __str__(self):
        return f"Transaction #{self.id} - {self.vehicle.license_plate}"

class ApprovalRequest(TimeStampedModel):
    ACTION_CHOICES = (
        ('CORRECTION', 'CORRECTION'),
        ('REVERSAL', 'REVERSAL'),
        ('CANCELLATION', 'CANCELLATION'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'PENDING'),
        ('APPROVED', 'APPROVED'),
        ('REJECTED', 'REJECTED'),
    )
    
    transaction = models.ForeignKey(WeighingTransaction, on_delete=models.CASCADE, related_name='approval_requests')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='requested_approvals')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='reviewed_approvals')
    
    request_reason = models.TextField()
    review_reason = models.TextField(null=True, blank=True)
    
    changes_payload = models.JSONField(null=True, blank=True) # Used for Corrections
    
    def __str__(self):
        return f"{self.action} on Tx #{self.transaction.id} ({self.status})"

