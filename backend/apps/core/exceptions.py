from rest_framework.views import exception_handler
from rest_framework.response import Response

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    if response is not None:
        custom_response_data = {
            'error': exc.__class__.__name__,
            'message': str(exc),
            'details': response.data
        }
        response.data = custom_response_data

    return response
