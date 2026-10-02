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
from apps.weighing.models import WeighingTransaction, ApprovalRequest
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
            'vehicle', 'material', 'driver', 'supplier', 'operator'
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
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            trans = create_weighing_transaction(user=request.user, **serializer.validated_data)
            return Response(WeighingTransactionSerializer(trans).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response(e.message_dict if hasattr(e, 'message_dict') else {'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def complete(self, request, pk=None):
        self.check_permissions(request)
        serializer = CompleteWeighingTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
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


class ApprovalRequestViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = ApprovalRequest.objects.all().order_by('-created_at')
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsAuthenticated] # Fine-grained per action below

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
