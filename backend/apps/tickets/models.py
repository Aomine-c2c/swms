from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedModel
from apps.weighing.models import WeighingTransaction
import uuid
from django.utils import timezone
import random
import string

def generate_ticket_number():
    date_str = timezone.now().strftime('%Y%m%d')
    random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"TKT-{date_str}-{random_str}"

class Ticket(TimeStampedModel):
    transaction = models.OneToOneField(WeighingTransaction, on_delete=models.PROTECT, related_name='ticket')
    ticket_number = models.CharField(max_length=50, unique=True, default=generate_ticket_number)
    generated_datetime = models.DateTimeField(auto_now_add=True)
    printed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    print_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.ticket_number
