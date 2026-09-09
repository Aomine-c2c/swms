from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import HasPermission
from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketSerializer
from apps.audit.services import log_audit_action

class TicketViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Ticket.objects.select_related('transaction__vehicle', 'transaction__material').order_by('-generated_datetime')
    serializer_class = TicketSerializer
    permission_classes = [IsAuthenticated, HasPermission('view_transactions')]

    @action(detail=True, methods=['post'])
    def reprint(self, request, pk=None):
        ticket = self.get_object()
        ticket.print_count += 1
        ticket.save()
        
        log_audit_action(
            user=request.user,
            action='TICKET_REPRINT',
            record_type='Ticket',
            record_id=ticket.id,
            previous_value={'print_count': ticket.print_count - 1},
            new_value={'print_count': ticket.print_count},
            reason="User initiated reprint"
        )
        
        return Response(TicketSerializer(ticket).data)
