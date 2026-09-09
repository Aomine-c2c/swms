from rest_framework import serializers
from apps.tickets.models import Ticket
from apps.weighing.serializers import WeighingTransactionSerializer

class TicketSerializer(serializers.ModelSerializer):
    printed_by_name = serializers.CharField(source='printed_by.username', read_only=True)
    transaction_details = WeighingTransactionSerializer(source='transaction', read_only=True)
    
    class Meta:
        model = Ticket
        fields = '__all__'
