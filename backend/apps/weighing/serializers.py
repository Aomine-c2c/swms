from rest_framework import serializers
from apps.weighing.models import WeighingTransaction, ApprovalRequest
from apps.core.serializers import VehicleSerializer, MaterialSerializer, DriverSerializer, SupplierSerializer

class WeighingTransactionSerializer(serializers.ModelSerializer):
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)
    material_details = MaterialSerializer(source='material', read_only=True)
    driver_details = DriverSerializer(source='driver', read_only=True)
    supplier_details = SupplierSerializer(source='supplier', read_only=True)
    operator_name = serializers.CharField(source='operator.username', read_only=True)
    
    class Meta:
        model = WeighingTransaction
        fields = '__all__'
        read_only_fields = ['operator', 'net_weight', 'status', 'created_at', 'updated_at']

class CorrectWeighingTransactionSerializer(serializers.Serializer):
    gross_weight = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    tare_weight = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    remarks = serializers.CharField(required=False)
    reason = serializers.CharField(required=True)

class CreateWeighingTransactionSerializer(serializers.ModelSerializer):
    weight_type = serializers.ChoiceField(choices=['gross', 'tare'], write_only=True)
    weight = serializers.DecimalField(max_digits=10, decimal_places=2, write_only=True)
    
    class Meta:
        model = WeighingTransaction
        fields = ['vehicle', 'driver', 'supplier', 'material', 'remarks', 'weight_type', 'weight', 'is_manual_entry', 'manual_entry_reason']

class CompleteWeighingTransactionSerializer(serializers.Serializer):
    weight = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    is_manual_entry = serializers.BooleanField(required=False, default=False)
    manual_entry_reason = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)

class CancelWeighingTransactionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True)

class FlagWeighingTransactionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True)

class ReverseWeighingTransactionSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255, required=True)

class ApprovalRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.username', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)
    transaction_details = WeighingTransactionSerializer(source='transaction', read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = '__all__'
        read_only_fields = ['status', 'requested_by', 'reviewed_by', 'review_reason', 'changes_payload']
