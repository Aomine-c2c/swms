from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.users.views import CurrentUserView, ThrottledTokenObtainPairView, LogoutView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API Schema and Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    # API V1 Routes
    path('api/v1/auth/token/', ThrottledTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/auth/logout/', LogoutView.as_view(), name='auth_logout'),
    path('api/v1/auth/me/', CurrentUserView.as_view(), name='auth_me'),
    
    path('api/v1/', include('smart_weigh.api_urls')),
]
