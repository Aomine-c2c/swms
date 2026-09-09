"""
Django settings for smart_weigh project.
"""

from pathlib import Path
import environ
import os
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialize environ
env = environ.Env(
    DEBUG=(bool, False)
)

# Read .env file if it exists
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

# Quick-start development settings - unsuitable for production
# Fallback to empty string to ensure it fails if not provided in production
SECRET_KEY = env('SECRET_KEY', default='django-insecure-default-key-for-dev' if env('DEBUG', default=False) else '')
if not SECRET_KEY:
    raise ValueError("SECRET_KEY must be provided in production")

DEBUG = env('DEBUG', default=False)

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['*'] if DEBUG else [])

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party
    'rest_framework',
    'corsheaders',
    
    # Local apps
    'apps.core',
    'apps.users',
    'apps.vehicles',
    'apps.drivers',
    'apps.suppliers',
    'apps.materials',
    'apps.weighing',
    'apps.tickets',
    'apps.reports',
    'apps.audit',
    'apps.system',
    
    # Architecture
    'drf_spectacular',
    'django_filters',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'smart_weigh.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'smart_weigh.wsgi.application'

# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

DATABASES = {
    'default': env.db('DATABASE_URL', default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
}

# Custom User Model
AUTH_USER_MODEL = 'users.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS configuration
CORS_ALLOW_ALL_ORIGINS = env.bool('CORS_ALLOW_ALL_ORIGINS', default=DEBUG)
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "tauri://localhost"
])

# Django REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '5/min',
        'user': '1000/min'
    },
    'EXCEPTION_HANDLER': 'apps.core.exceptions.custom_exception_handler'
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
}

# ─────────────────────────────────────────────────────────────────
# Backup configuration
# All values configurable via environment variables.
# BACKUP_DIR is the only required override in production.
# ─────────────────────────────────────────────────────────────────
BACKUP_DIR = env('BACKUP_DIR', default=str(BASE_DIR / 'backups'))
BACKUP_RETENTION_DAILY = env.int('BACKUP_RETENTION_DAILY', default=7)
BACKUP_RETENTION_WEEKLY = env.int('BACKUP_RETENTION_WEEKLY', default=4)
BACKUP_RETENTION_MONTHLY = env.int('BACKUP_RETENTION_MONTHLY', default=12)
# Path to mysqldump/mysql binaries (only needed for MySQL engine)
MYSQLDUMP_PATH = env('MYSQLDUMP_PATH', default='mysqldump')
MYSQL_PATH = env('MYSQL_PATH', default='mysql')

# Spectacular Schema configuration
SPECTACULAR_SETTINGS = {
    'TITLE': 'Smart-Weigh API',
    'DESCRIPTION': 'Weighbridge Management System API',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

if DEBUG:
    REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] += ('rest_framework.renderers.BrowsableAPIRenderer',)

# ─────────────────────────────────────────────────────────────────
# Security & HTTPS Configuration
# ─────────────────────────────────────────────────────────────────
SECURE_PROTOCOLS = env.bool('SECURE_PROTOCOLS', default=False)
if SECURE_PROTOCOLS:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ─────────────────────────────────────────────────────────────────
# Production Logging Architecture
# ─────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file_django': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'maxBytes': 1024 * 1024 * 15,  # 15 MB
            'backupCount': 10,
            'formatter': 'verbose',
        },
        'file_app': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'smart_weigh.log',
            'maxBytes': 1024 * 1024 * 15,  # 15 MB
            'backupCount': 10,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file_django'] if not DEBUG else ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'smart_weigh': {
            'handlers': ['console', 'file_app'] if not DEBUG else ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
