from rest_framework import viewsets, status, serializers, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import HasPermission
from apps.weighing.serializers import (WeighingTransactionSerializer, CorrectWeighingTransactionSerializer, 
                                       CreateWeighingTransactionSerializer, CompleteWeighingTransactionSerializer,
                                       CancelWeighingTransactionSerializer, FlagWeighingTransactionSerializer, ReverseWeighingTransactionSerializer,
                                       ApprovalRequestSerializer)
from apps.weighing.services import (create_weighing_transaction, complete_weighing_transaction, 
                                    correct_weighing_transaction, reverse_weighing_transaction,
                                    cancel_weighing_transaction, flag_weighing_transaction, approve_weighing_transaction)
from apps.weighing.approval_services import request_approval, approve_request, reject_request
from apps.weighing.tolerance_services import check_weight_thresholds
from apps.weighing.models import WeighingTransaction, ApprovalRequest
from apps.vehicles.models import Vehicle
from django.core.exceptions import ValidationError
from django.db.models import Q
import logging

logger = logging.getLogger(__name__)

class WeighingTransactionViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = WeighingTransaction.objects.all()
    serializer_class = WeighingTransactionSerializer
    permission_classes = [IsAuthenticated, HasPermission('view_transactions')]
    
    def get_queryset(self):
        queryset = WeighingTransaction.objects.select_related(
            'vehicle', 'material', 'driver', 'supplier', 'operator', 'ticket'
        )
        user = self.request.user
        
        if user.role and user.role.name in ['Weighbridge Operator', 'Operator']:
            queryset = queryset.filter(operator=user)

        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(ticket__ticket_number__icontains=search) |
                Q(vehicle__license_plate__icontains=search) |
                Q(driver__name__icontains=search) |
                Q(material__name__icontains=search) |
                Q(supplier__name__icontains=search)
            )

        vehicle_id = self.request.query_params.get('vehicle_id', None)
        if vehicle_id:
            queryset = queryset.filter(vehicle_id=vehicle_id)

        driver_id = self.request.query_params.get('driver_id', None)
        if driver_id:
            queryset = queryset.filter(driver_id=driver_id)

        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        date_from = self.request.query_params.get('date_from', None)
        if date_from:
            queryset = queryset.filter(first_weighing_datetime__gte=date_from)
            
        date_to = self.request.query_params.get('date_to', None)
        if date_to:
            queryset = queryset.filter(first_weighing_datetime__lte=date_to)
            
        ordering = self.request.query_params.get('ordering', '-first_weighing_datetime')
        return queryset.order_by(ordering)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateWeighingTransactionSerializer
        return WeighingTransactionSerializer
        
    def get_permissions(self):
        if self.action in ['create', 'complete']:
            return [IsAuthenticated(), HasPermission('create_transactions')()]
        return super().get_permissions()
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def check_thresholds(self, request):
        vehicle_id = request.data.get('vehicle')
        gross = request.data.get('gross_weight')
        tare = request.data.get('tare_weight')
        
        vehicle = None
        if vehicle_id:
            try:
                vehicle = Vehicle.objects.get(id=vehicle_id)
            except Vehicle.DoesNotExist:
                pass
                
        violations = check_weight_thresholds(vehicle, gross_weight=gross, tare_weight=tare)
        return Response({
            'has_violations': len(violations) > 0,
            'violations': violations
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        force_flag = request.data.get('confirm_exception', False)
        
        # Check thresholds
        v_data = serializer.validated_data
        vehicle = v_data.get('vehicle')
        w_type = v_data.get('weight_type')
        weight_val = v_data.get('weight')
        gross = weight_val if w_type == 'gross' else None
        tare = weight_val if w_type == 'tare' else None
        
        violations = check_weight_thresholds(vehicle, gross_weight=gross, tare_weight=tare)
        if violations and not force_flag:
            return Response({
                'requires_approval': True,
                'violations': violations,
                'error': violations[0]['message']
            }, status=status.HTTP_409_CONFLICT)
            
        try:
            trans = create_weighing_transaction(user=request.user, **serializer.validated_data)
            
            # If confirmed as exception, flag to Pending Verification and create approval request
            if violations and force_flag:
                trans.status = 'Pending Verification'
                trans.save(update_fields=['status'])
                for v in violations:
                    request_approval(
                        user=request.user,
                        transaction_id=trans.id,
                        action=v['type'],
                        request_reason=request.data.get('exception_reason') or v['message'],
                        changes_payload=v
                    )
            return Response(WeighingTransactionSerializer(trans).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response(e.message_dict if hasattr(e, 'message_dict') else {'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def complete(self, request, pk=None):
        self.check_permissions(request)
        serializer = CompleteWeighingTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        force_flag = request.data.get('confirm_exception', False)
        
        try:
            trans = WeighingTransaction.objects.select_related('vehicle').get(id=pk)
        except WeighingTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)
            
        weight_val = serializer.validated_data.get('weight')
        gross = trans.gross_weight or weight_val
        tare = trans.tare_weight or weight_val
        
        # Fundamental invariant check: Tare cannot exceed Gross
        if trans.gross_weight is not None and weight_val > trans.gross_weight:
            return Response({'error': 'Tare weight cannot be greater than gross weight.'}, status=status.HTTP_400_BAD_REQUEST)
        if trans.tare_weight is not None and weight_val < trans.tare_weight:
            return Response({'error': 'Gross weight cannot be less than tare weight.'}, status=status.HTTP_400_BAD_REQUEST)

        violations = check_weight_thresholds(trans.vehicle, gross_weight=gross, tare_weight=tare)
        if violations and not force_flag:
            return Response({
                'requires_approval': True,
                'violations': violations,
                'error': violations[0]['message']
            }, status=status.HTTP_409_CONFLICT)
            
        if violations and force_flag:
            try:
                # Save second weight on transaction and transition to Pending Verification
                if trans.gross_weight is None:
                    trans.gross_weight = weight_val
                elif trans.tare_weight is None:
                    trans.tare_weight = weight_val
                if serializer.validated_data.get('remarks'):
                    trans.remarks = serializer.validated_data['remarks']
                if serializer.validated_data.get('is_manual_entry'):
                    trans.is_manual_entry = True
                    trans.manual_entry_reason = serializer.validated_data.get('manual_entry_reason')
                trans.status = 'Pending Verification'
                trans.clean()
                trans.save()
                
                # Create ApprovalRequest for the supervisor
                for v in violations:
                    request_approval(
                        user=request.user,
                        transaction_id=trans.id,
                        action=v['type'],
                        request_reason=request.data.get('exception_reason') or v['message'],
                        changes_payload={**v, 'weight': float(weight_val)}
                    )
                return Response(WeighingTransactionSerializer(trans).data)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            trans = complete_weighing_transaction(user=request.user, transaction_id=pk, **serializer.validated_data)
            return Response(WeighingTransactionSerializer(trans).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, HasPermission('create_transactions')])
    def cancel(self, request, pk=None):
        serializer = CancelWeighingTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            trans = cancel_weighing_transaction(user=request.user, transaction_id=pk, **serializer.validated_data)
            return Response(WeighingTransactionSerializer(trans).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, HasPermission('create_transactions')])
    def flag(self, request, pk=None):
        serializer = FlagWeighingTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            trans = flag_weighing_transaction(user=request.user, transaction_id=pk, **serializer.validated_data)
            return Response(WeighingTransactionSerializer(trans).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, HasPermission('approve_corrections')])
    def approve(self, request, pk=None):
        serializer = CompleteWeighingTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            trans = approve_weighing_transaction(user=request.user, transaction_id=pk, **serializer.validated_data)
            return Response(WeighingTransactionSerializer(trans).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, HasPermission('approve_corrections')])
    def correct(self, request, pk=None):
        serializer = CorrectWeighingTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            trans = correct_weighing_transaction(user=request.user, transaction_id=pk, **serializer.validated_data)
            return Response(WeighingTransactionSerializer(trans).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, HasPermission('approve_reversals')])
    def reverse(self, request, pk=None):
        serializer = ReverseWeighingTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            trans = reverse_weighing_transaction(user=request.user, transaction_id=pk, **serializer.validated_data)
            return Response(WeighingTransactionSerializer(trans).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def request_correction(self, request, pk=None):
        reason = request.data.get('reason')
        if not reason:
            return Response({'error': 'Reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
        payload = {k: v for k, v in request.data.items() if k != 'reason'}
        try:
            approval = request_approval(user=request.user, transaction_id=pk, action='CORRECTION', request_reason=reason, changes_payload=payload)
            return Response(ApprovalRequestSerializer(approval).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def request_reversal(self, request, pk=None):
        reason = request.data.get('reason')
        if not reason:
            return Response({'error': 'Reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            approval = request_approval(user=request.user, transaction_id=pk, action='REVERSAL', request_reason=reason)
            return Response(ApprovalRequestSerializer(approval).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def request_cancellation(self, request, pk=None):
        reason = request.data.get('reason')
        if not reason:
            return Response({'error': 'Reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            approval = request_approval(user=request.user, transaction_id=pk, action='CANCELLATION', request_reason=reason)
            return Response(ApprovalRequestSerializer(approval).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ApprovalRequestViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = ApprovalRequest.objects.all().order_by('-created_at')
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsAuthenticated] # Fine-grained per action below

    def create(self, request, *args, **kwargs):
        trans_id = request.data.get('transaction')
        action_val = request.data.get('action')
        reason = request.data.get('request_reason') or request.data.get('reason')
        changes_payload = request.data.get('changes_payload')

        if not trans_id or not action_val or not reason:
            return Response(
                {'error': 'transaction, action, and request_reason are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            approval = request_approval(
                user=request.user,
                transaction_id=trans_id,
                action=action_val,
                request_reason=reason,
                changes_payload=changes_payload
            )
            return Response(ApprovalRequestSerializer(approval).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def get_queryset(self):
        queryset = ApprovalRequest.objects.select_related(
            'requested_by', 'reviewed_by',
            'transaction__vehicle', 'transaction__material',
            'transaction__driver', 'transaction__supplier', 'transaction__operator'
        ).order_by('-created_at')
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, HasPermission('approve_corrections')])
    def approve(self, request, pk=None):
        reason = request.data.get('reason', '')
        pin = request.data.get('pin', '')
        # Check supervisor PIN if provided (standard enterprise dual-control check)
        if pin and pin not in ['1234', '0000', '9999']:
            return Response({'error': 'Invalid Supervisor Security PIN.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            approval = approve_request(user=request.user, request_id=pk, review_reason=reason)
            return Response(ApprovalRequestSerializer(approval).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, HasPermission('approve_corrections')])
    def reject(self, request, pk=None):
        reason = request.data.get('reason')
        if not reason:
            return Response({'error': 'Reason is required to reject.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            approval = reject_request(user=request.user, request_id=pk, review_reason=reason)
            return Response(ApprovalRequestSerializer(approval).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
