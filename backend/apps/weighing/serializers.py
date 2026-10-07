from rest_framework import serializers
from apps.weighing.models import WeighingTransaction, ApprovalRequest
from apps.core.serializers import VehicleSerializer, MaterialSerializer, DriverSerializer, SupplierSerializer

class WeighingTransactionSerializer(serializers.ModelSerializer):
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)
    material_details = MaterialSerializer(source='material', read_only=True)
    driver_details = DriverSerializer(source='driver', read_only=True)
    supplier_details = SupplierSerializer(source='supplier', read_only=True)
    operator_name = serializers.CharField(source='operator.username', read_only=True)
    ticket_number = serializers.SerializerMethodField()

    def get_ticket_number(self, obj):
        if hasattr(obj, 'ticket') and obj.ticket:
            return obj.ticket.ticket_number
        return None
    
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
    weight_type = serializers.ChoiceField(choices=['gross', 'tare'], required=False, write_only=True)
    weight = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, write_only=True)
    gross_weight = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, write_only=True)
    tare_weight = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, write_only=True)
    is_manual_entry = serializers.BooleanField(required=False, default=False)
    manual_entry_reason = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    
    class Meta:
        model = WeighingTransaction
        fields = ['vehicle', 'driver', 'supplier', 'material', 'remarks', 'weight_type', 'weight', 'gross_weight', 'tare_weight', 'is_manual_entry', 'manual_entry_reason']

    def validate(self, attrs):
        # Resolve weight_type and weight from direct fields or gross_weight / tare_weight fields
        w_type = attrs.get('weight_type')
        weight = attrs.get('weight')
        gross = attrs.get('gross_weight')
        tare = attrs.get('tare_weight')

        if not w_type or weight is None:
            if gross is not None:
                attrs['weight_type'] = 'gross'
                attrs['weight'] = gross
            elif tare is not None:
                attrs['weight_type'] = 'tare'
                attrs['weight'] = tare
            else:
                raise serializers.ValidationError("Either 'weight_type' and 'weight', or 'gross_weight' / 'tare_weight' must be provided.")

        attrs.pop('gross_weight', None)
        attrs.pop('tare_weight', None)

        is_manual = attrs.get('is_manual_entry', False)
        reason = attrs.get('manual_entry_reason')
        if is_manual and not (reason and reason.strip()):
            raise serializers.ValidationError({"manual_entry_reason": "A reason must be provided for manual weight entries."})

        return attrs

class CompleteWeighingTransactionSerializer(serializers.Serializer):
    weight = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)
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
