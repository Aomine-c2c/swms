from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.weighing.models import WeighingTransaction
from apps.tickets.models import Ticket
from apps.audit.services import log_audit_action

@transaction.atomic
def create_weighing_transaction(user, weight_type, weight, **kwargs):
    if weight_type == 'gross':
        kwargs['gross_weight'] = weight
    elif weight_type == 'tare':
        kwargs['tare_weight'] = weight
    else:
        raise ValidationError("weight_type must be 'gross' or 'tare'")
        
    is_manual_entry = kwargs.pop('is_manual_entry', False)
    manual_entry_reason = kwargs.pop('manual_entry_reason', None)
    
    kwargs['first_weighing_datetime'] = timezone.now()
    kwargs['status'] = 'Open'
    kwargs['is_manual_entry'] = is_manual_entry
    kwargs['manual_entry_reason'] = manual_entry_reason

    trans = WeighingTransaction(operator=user, **kwargs)
    trans.clean() 
    trans.save()
    
    log_audit_action(user, 'CREATE', 'WeighingTransaction', trans.id, new_value={
        'status': trans.status, 
        weight_type: float(weight),
        'is_manual_entry': is_manual_entry,
        'manual_entry_reason': manual_entry_reason
    })
    return trans

@transaction.atomic
def complete_weighing_transaction(user, transaction_id, weight, is_manual_entry=False, manual_entry_reason=None):
    trans = WeighingTransaction.objects.get(id=transaction_id)
    if trans.status != 'Open':
        raise ValidationError("Only Open transactions can be completed directly.")
        
    if trans.gross_weight is None:
        trans.gross_weight = weight
    elif trans.tare_weight is None:
        trans.tare_weight = weight
    else:
        raise ValidationError("Both weights are already captured.")
        
    if is_manual_entry:
        trans.is_manual_entry = True
        trans.manual_entry_reason = manual_entry_reason

    trans.second_weighing_datetime = timezone.now()
    trans.status = 'Completed'
    
    trans.clean()
    trans.save()
    
    ticket = Ticket.objects.create(transaction=trans, printed_by=user)
    
    log_audit_action(user, 'TICKET_GENERATE', 'Ticket', ticket.id, new_value={'ticket_number': ticket.ticket_number, 'transaction_id': trans.id})
    
    log_audit_action(user, 'COMPLETE', 'WeighingTransaction', trans.id, 
                     previous_value={'status': 'Open'}, 
                     new_value={
                         'status': trans.status, 
                         'net_weight': float(trans.net_weight), 
                         'ticket': ticket.ticket_number,
                         'is_manual_entry': trans.is_manual_entry,
                         'manual_entry_reason': trans.manual_entry_reason
                     })
    return trans

@transaction.atomic
def cancel_weighing_transaction(user, transaction_id, reason):
    trans = WeighingTransaction.objects.get(id=transaction_id)
    if trans.status not in ['Open', 'Pending Verification']:
        raise ValidationError(f"Cannot cancel a transaction in '{trans.status}' status.")
        
    prev_status = trans.status
    trans.status = 'Cancelled'
    trans.save()
    
    log_audit_action(user, 'CANCEL', 'WeighingTransaction', trans.id, 
                     previous_value={'status': prev_status}, 
                     new_value={'status': trans.status}, reason=reason)
    return trans

@transaction.atomic
def flag_weighing_transaction(user, transaction_id, reason):
    trans = WeighingTransaction.objects.get(id=transaction_id)
    if trans.status != 'Open':
        raise ValidationError("Only Open transactions can be flagged for verification.")
        
    prev_status = trans.status
    trans.status = 'Pending Verification'
    trans.save()
    
    log_audit_action(user, 'FLAG', 'WeighingTransaction', trans.id, 
                     previous_value={'status': prev_status}, 
                     new_value={'status': trans.status}, reason=reason)
    return trans

@transaction.atomic
def approve_weighing_transaction(user, transaction_id, weight):
    # This is basically 'complete' but starting from Pending Verification
    trans = WeighingTransaction.objects.get(id=transaction_id)
    if trans.status != 'Pending Verification':
        raise ValidationError("Only Pending Verification transactions can be approved.")
        
    if trans.gross_weight is None:
        trans.gross_weight = weight
    elif trans.tare_weight is None:
        trans.tare_weight = weight
    else:
        # If it was flagged for another reason, the weights might already be captured, but our current workflow captures the second weight on completion.
        raise ValidationError("Both weights are already captured.")
        
    trans.second_weighing_datetime = timezone.now()
    trans.status = 'Completed'
    
    trans.clean()
    trans.save()
    
    ticket = Ticket.objects.create(transaction=trans, printed_by=user)
    
    log_audit_action(user, 'TICKET_GENERATE', 'Ticket', ticket.id, new_value={'ticket_number': ticket.ticket_number, 'transaction_id': trans.id})
    
    log_audit_action(user, 'APPROVE', 'WeighingTransaction', trans.id, 
                     previous_value={'status': 'Pending Verification'}, 
                     new_value={'status': trans.status, 'net_weight': float(trans.net_weight), 'ticket': ticket.ticket_number})
    return trans

@transaction.atomic
def update_weighing_transaction(user, transaction_id, **kwargs):
    # Standard update is heavily restricted to prevent status tampering.
    trans = WeighingTransaction.objects.get(id=transaction_id)
    if trans.status in ['Completed', 'Corrected', 'Reversed', 'Cancelled']:
        raise ValidationError("Cannot standard update a closed transaction.")
        
    # Prevent tampering with status directly via update
    if 'status' in kwargs and kwargs['status'] != trans.status:
        raise ValidationError("Cannot update status via standard update. Use explicit workflow endpoints.")
        
    prev_status = trans.status
    for key, value in kwargs.items():
        setattr(trans, key, value)
    
    trans.clean()
    trans.save()
    
    log_audit_action(user, 'UPDATE', 'WeighingTransaction', trans.id, 
                     previous_value={'status': prev_status}, 
                     new_value={'status': trans.status})
    return trans

@transaction.atomic
def correct_weighing_transaction(user, transaction_id, reason, **kwargs):
    trans = WeighingTransaction.objects.get(id=transaction_id)
    if trans.status not in ['Completed']:
        raise ValidationError("Only Completed transactions can be corrected.")
    
    prev_state = {
        'status': trans.status,
        'gross_weight': float(trans.gross_weight) if trans.gross_weight else None,
        'tare_weight': float(trans.tare_weight) if trans.tare_weight else None
    }
    
    for key, value in kwargs.items():
        setattr(trans, key, value)
        
    trans.status = 'Corrected'
    trans.clean()
    trans.save()
    
    new_state = {
        'status': trans.status,
        'gross_weight': float(trans.gross_weight) if trans.gross_weight else None,
        'tare_weight': float(trans.tare_weight) if trans.tare_weight else None
    }
    log_audit_action(user, 'CORRECT', 'WeighingTransaction', trans.id, previous_value=prev_state, new_value=new_state, reason=reason)
    return trans

@transaction.atomic
def reverse_weighing_transaction(user, transaction_id, reason):
    trans = WeighingTransaction.objects.get(id=transaction_id)
    if trans.status not in ['Completed', 'Corrected']:
        raise ValidationError("Only Completed or Corrected transactions can be reversed.")
    
    prev_status = trans.status
    trans.status = 'Reversed'
    trans.save()
    
    log_audit_action(user, 'REVERSE', 'WeighingTransaction', trans.id, previous_value={'status': prev_status}, new_value={'status': trans.status}, reason=reason)
    return trans
