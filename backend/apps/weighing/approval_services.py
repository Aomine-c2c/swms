from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.weighing.models import WeighingTransaction, ApprovalRequest
from apps.weighing.services import correct_weighing_transaction, reverse_weighing_transaction, cancel_weighing_transaction
from apps.audit.services import log_audit_action

@transaction.atomic
def request_approval(user, transaction_id, action, request_reason, changes_payload=None):
    if action not in dict(ApprovalRequest.ACTION_CHOICES):
        raise ValidationError(f"Invalid action: {action}")
        
    trans = WeighingTransaction.objects.get(id=transaction_id)
    
    # Check if there is already a pending request for this transaction
    if trans.approval_requests.filter(status='PENDING').exists():
        raise ValidationError("This transaction already has a pending approval request.")
        
    if action == 'CANCELLATION':
        if trans.status not in ['Open', 'Pending Verification']:
            raise ValidationError("Only Open or Pending transactions can be cancelled.")
    else:
        if trans.status not in ['Completed', 'Corrected']:
            raise ValidationError(f"Only Completed/Corrected transactions can be {action.lower()}ed.")
            
    request = ApprovalRequest.objects.create(
        transaction=trans,
        action=action,
        requested_by=user,
        request_reason=request_reason,
        changes_payload=changes_payload
    )
    
    log_audit_action(user, 'CREATE', 'ApprovalRequest', request.id, new_value={'action': action, 'transaction_id': trans.id})
    return request

@transaction.atomic
def approve_request(user, request_id, review_reason=""):
    approval_request = ApprovalRequest.objects.select_related('transaction', 'requested_by').get(id=request_id)
    
    if approval_request.status != 'PENDING':
        raise ValidationError("Only PENDING requests can be approved.")
        
    if approval_request.requested_by == user:
        raise ValidationError("You cannot approve your own request.")
        
    # Execute the requested action
    trans_id = approval_request.transaction.id
    if approval_request.action == 'CORRECTION':
        payload = approval_request.changes_payload or {}
        correct_weighing_transaction(user, trans_id, approval_request.request_reason, **payload)
    elif approval_request.action == 'REVERSAL':
        reverse_weighing_transaction(user, trans_id, approval_request.request_reason)
    elif approval_request.action == 'CANCELLATION':
        cancel_weighing_transaction(user, trans_id, approval_request.request_reason)
        
    approval_request.status = 'APPROVED'
    approval_request.reviewed_by = user
    approval_request.review_reason = review_reason
    approval_request.save()
    
    log_audit_action(user, 'APPROVE', 'ApprovalRequest', approval_request.id, previous_value={'status': 'PENDING'}, new_value={'status': 'APPROVED'})
    return approval_request

@transaction.atomic
def reject_request(user, request_id, review_reason):
    approval_request = ApprovalRequest.objects.get(id=request_id)
    
    if approval_request.status != 'PENDING':
        raise ValidationError("Only PENDING requests can be rejected.")
        
    if approval_request.requested_by == user:
        raise ValidationError("You cannot reject your own request.")
        
    if not review_reason:
        raise ValidationError("A reason is required when rejecting a request.")
        
    approval_request.status = 'REJECTED'
    approval_request.reviewed_by = user
    approval_request.review_reason = review_reason
    approval_request.save()
    
    log_audit_action(user, 'REJECT', 'ApprovalRequest', approval_request.id, previous_value={'status': 'PENDING'}, new_value={'status': 'REJECTED', 'reason': review_reason})
    return approval_request
