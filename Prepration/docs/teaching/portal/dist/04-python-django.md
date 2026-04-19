# Python & Django

## Prerequisites

- Python fundamentals: functions, classes, inheritance, list comprehensions
- Decorators: understanding `@decorator` syntax and how they wrap functions
- Type hints: `def foo(x: int) -> str` — you don't need mypy expertise, just familiarity
- Basic HTTP: GET/POST, status codes, JSON payloads
- SQL: you know what SELECT, INSERT, and JOIN mean

---

## What & Why

Django is Python's "batteries-included" web framework. It ships with an ORM, admin interface, authentication system, form validation, migrations, and a development server — all in one package. The Django REST Framework (DRF) adds first-class REST API support on top.

**Why TML uses Python/Django for certain services:**

1. **Data-heavy workloads.** Python's ecosystem for data processing is unmatched. `pandas` for DataFrame manipulation, `openpyxl`/`XlsxWriter` for Excel export, and `numpy` for numerical work all integrate naturally into a Django service.

2. **Rapid development.** The Django ORM eliminates raw SQL for 90% of queries. The admin panel gives operations teams a UI with zero frontend code. Migrations track schema changes in version control.

3. **Kafka consumers as management commands.** Django's `BaseCommand` pattern makes it easy to run long-lived Kafka consumer loops as part of the same Django application, sharing models, settings, and database connections.

4. **Keycloak integration.** The `python-keycloak` library provides token introspection and userinfo calls with minimal setup, fitting cleanly into DRF's permission class system.

---

## Core Concepts

**MVT (Model-View-Template) Pattern**
Django's architectural pattern. In an API context: Model defines the data shape and database table, View handles the HTTP request and returns JSON (not HTML), Template is replaced by DRF Serializers that convert model instances to JSON.

**Django ORM**
Write Python code; Django generates SQL. `Material.objects.filter(plant_code="PUNE")` becomes `SELECT * FROM materials WHERE plant_code = 'PUNE'`. Migrations track every `models.py` change and generate `ALTER TABLE` / `CREATE TABLE` SQL.

**URL Routing**
`urls.py` maps URL patterns to views. DRF's `Router` auto-generates CRUD URLs from a `ViewSet`.

**Serializers**
Convert between Python objects (model instances, dicts) and JSON. Validate incoming data before it touches the database.

---

## Installation & Setup

```bash
# Create and activate a virtual environment
python -m venv venv && source venv/bin/activate   # Linux/Mac
# venv\Scripts\activate  on Windows

# Install core dependencies
pip install django djangorestframework psycopg2-binary python-dotenv

# Create project and app
django-admin startproject myproject .
python manage.py startapp inventory

# Run development server
python manage.py runserver
```

**`myproject/settings.py` — PostgreSQL database config:**

```python
import os
from dotenv import load_dotenv

load_dotenv()

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME':     os.environ['DB_NAME'],
        'USER':     os.environ['DB_USER'],
        'PASSWORD': os.environ['DB_PASSWORD'],
        'HOST':     os.environ.get('DB_HOST', 'localhost'),
        'PORT':     os.environ.get('DB_PORT', '5432'),
    }
}

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'rest_framework',
    'inventory',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}
```

---

## Beginner

### Model definition

```python
# inventory/models.py
from django.db import models

class Vendor(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'vendors'

    def __str__(self):
        return f"{self.code} – {self.name}"


class Material(models.Model):
    material_code = models.CharField(max_length=50)
    description   = models.CharField(max_length=200)
    plant_code    = models.CharField(max_length=10)
    vendor        = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='materials')
    stock         = models.IntegerField(default=0)
    unit_price    = models.DecimalField(max_digits=12, decimal_places=2)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'materials'
        unique_together = [('material_code', 'plant_code')]

    def __str__(self):
        return self.material_code
```

```bash
# Generate and apply migrations
python manage.py makemigrations inventory
python manage.py migrate
```

### ModelSerializer

```python
# inventory/serializers.py
from rest_framework import serializers
from .models import Material, Vendor

class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Vendor
        fields = ['id', 'code', 'name', 'is_active']
        read_only_fields = ['id']


class MaterialSerializer(serializers.ModelSerializer):
    vendor_code = serializers.CharField(source='vendor.code', read_only=True)

    class Meta:
        model  = Material
        fields = ['id', 'material_code', 'description', 'plant_code',
                  'vendor', 'vendor_code', 'stock', 'unit_price', 'created_at']
        read_only_fields = ['id', 'created_at']
```

### ViewSet (full CRUD)

```python
# inventory/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Material
from .serializers import MaterialSerializer

class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.select_related('vendor').all()
    serializer_class = MaterialSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        plant = self.request.query_params.get('plant')
        if plant:
            qs = qs.filter(plant_code=plant)
        return qs

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        threshold = int(request.query_params.get('threshold', 100))
        items = self.get_queryset().filter(stock__lt=threshold)
        serializer = self.get_serializer(items, many=True)
        return Response(serializer.data)
```

### Function-based view with `@api_view`

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_summary(request):
    if request.method == 'GET':
        total = Material.objects.filter(plant_code=request.query_params.get('plant', '')).count()
        return Response({'total_materials': total})
    elif request.method == 'POST':
        serializer = MaterialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
```

### URL configuration

```python
# inventory/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('materials', views.MaterialViewSet, basename='material')
router.register('vendors',   views.VendorViewSet,   basename='vendor')

urlpatterns = [
    path('', include(router.urls)),
    path('summary/', views.stock_summary),
]

# myproject/urls.py
from django.urls import path, include

urlpatterns = [
    path('api/inventory/', include('inventory.urls')),
]
```

---

## Intermediate

### QuerySet power features

```python
from django.db.models import Count, Sum, Avg, Q, F

# Filtering with lookups
Material.objects.filter(stock__lt=100, plant_code='PUNE')
Material.objects.exclude(vendor__is_active=False)

# Complex Q objects (OR logic)
Material.objects.filter(Q(stock__lt=50) | Q(plant_code='MUMBAI'))

# Annotate each row with computed value
from django.db.models import Count
vendors = Vendor.objects.annotate(material_count=Count('materials'))

# Aggregate across all rows
from django.db.models import Sum
total_value = Material.objects.aggregate(
    total=Sum(F('stock') * F('unit_price'))
)['total']

# select_related: SQL JOIN — use for ForeignKey/OneToOne
materials = Material.objects.select_related('vendor').all()
# Access vendor.name without extra queries

# prefetch_related: separate query + Python join — use for ManyToMany/reverse FK
vendors = Vendor.objects.prefetch_related('materials').all()

# values() returns dicts instead of model instances (faster for read-only)
Material.objects.values('material_code', 'plant_code', 'stock')

# distinct
Material.objects.values('plant_code').distinct()
```

### JWT authentication with `rest_framework_simplejwt`

```bash
pip install djangorestframework-simplejwt
```

```python
# settings.py
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
}

# urls.py (root)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns += [
    path('api/token/',         TokenObtainPairView.as_view()),
    path('api/token/refresh/', TokenRefreshView.as_view()),
]
```

### Custom permission class

```python
# inventory/permissions.py
from rest_framework.permissions import BasePermission

class IsPlantManager(BasePermission):
    message = 'Only plant managers can perform this action.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.groups.filter(name='PlantManagers').exists()
        )

    def has_object_permission(self, request, view, obj):
        # Object-level: only manage materials in the manager's plant
        return obj.plant_code == request.user.profile.plant_code
```

### Pagination and filtering

```python
# inventory/filters.py
import django_filters
from .models import Material

class MaterialFilter(django_filters.FilterSet):
    min_stock = django_filters.NumberFilter(field_name='stock', lookup_expr='gte')
    max_stock = django_filters.NumberFilter(field_name='stock', lookup_expr='lte')
    plant     = django_filters.CharFilter(field_name='plant_code', lookup_expr='iexact')

    class Meta:
        model = Material
        fields = ['plant', 'min_stock', 'max_stock', 'vendor']

# views.py — add to ViewSet
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

class MaterialViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = MaterialFilter
    search_fields   = ['material_code', 'description']
    ordering_fields = ['stock', 'created_at']
```

### Custom management command

```python
# inventory/management/commands/sync_stock.py
from django.core.management.base import BaseCommand
from inventory.models import Material
from inventory.services import StockSyncService

class Command(BaseCommand):
    help = 'Synchronises stock levels from ERP system'

    def add_arguments(self, parser):
        parser.add_argument('--plant', type=str, required=True)
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        plant    = options['plant']
        dry_run  = options['dry_run']
        service  = StockSyncService()

        self.stdout.write(f"Syncing stock for plant {plant}...")
        count = service.sync(plant, dry_run=dry_run)
        self.stdout.write(self.style.SUCCESS(f"Updated {count} materials"))
```

```bash
python manage.py sync_stock --plant PUNE
python manage.py sync_stock --plant PUNE --dry-run
```

---

## Advanced

### Django signals

```python
# inventory/signals.py
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from .models import Material
from .tasks import notify_low_stock

@receiver(post_save, sender=Material)
def check_stock_level(sender, instance, created, **kwargs):
    if not created and instance.stock < 50:
        notify_low_stock.delay(instance.material_code, instance.plant_code, instance.stock)

@receiver(pre_delete, sender=Material)
def archive_before_delete(sender, instance, **kwargs):
    MaterialArchive.objects.create(
        material_code=instance.material_code,
        plant_code=instance.plant_code,
        stock=instance.stock,
        archived_at=timezone.now()
    )

# apps.py — connect signals on app ready
class InventoryConfig(AppConfig):
    name = 'inventory'

    def ready(self):
        import inventory.signals  # noqa: F401
```

### pandas DataFrame from QuerySet

```python
import pandas as pd
from inventory.models import Material

def build_stock_report(plant_code: str) -> pd.DataFrame:
    qs = (
        Material.objects
        .filter(plant_code=plant_code)
        .select_related('vendor')
        .values('material_code', 'description', 'stock', 'unit_price', 'vendor__name')
    )
    df = pd.DataFrame(list(qs))
    df.rename(columns={'vendor__name': 'vendor_name'}, inplace=True)
    df['stock_value'] = df['stock'] * df['unit_price']
    df = df.sort_values('stock_value', ascending=False)
    return df
```

### openpyxl: write workbook from queryset

```python
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from django.http import HttpResponse

def export_stock_excel(request):
    df = build_stock_report(request.query_params.get('plant', ''))

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Stock Report"

    headers = ['Material Code', 'Description', 'Vendor', 'Stock', 'Unit Price', 'Stock Value']
    for col, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='1F4E79')

    for row_idx, row in enumerate(df.itertuples(), start=2):
        ws.append([row.material_code, row.description, row.vendor_name,
                   row.stock, float(row.unit_price), float(row.stock_value)])

    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = 'attachment; filename="stock_report.xlsx"'
    wb.save(response)
    return response
```

### Kafka producer in Django

```python
# inventory/kafka_producer.py
import json
import logging
from kafka import KafkaProducer
from django.conf import settings

log = logging.getLogger(__name__)

_producer = None

def get_producer() -> KafkaProducer:
    global _producer
    if _producer is None:
        _producer = KafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            acks='all',
            retries=3,
        )
    return _producer

def publish_stock_event(material_code: str, plant: str, delta: int):
    payload = {'materialCode': material_code, 'plantCode': plant, 'delta': delta}
    get_producer().send(settings.KAFKA_STOCK_TOPIC, value=payload)
    log.info("Published stock event: %s", payload)
```

### Kafka consumer as management command

```python
# inventory/management/commands/consume_stock_events.py
import json
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from kafka import KafkaConsumer
from inventory.models import Material

log = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Consumes stock update events from Kafka'

    def handle(self, *args, **options):
        consumer = KafkaConsumer(
            settings.KAFKA_STOCK_TOPIC,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id='inventory-stock-consumer',
            auto_offset_reset='earliest',
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        )
        self.stdout.write("Listening for stock events...")
        for message in consumer:
            try:
                data = message.value
                Material.objects.filter(
                    material_code=data['materialCode'],
                    plant_code=data['plantCode']
                ).update(stock=data['stock'])
                log.info("Updated stock for %s/%s", data['materialCode'], data['plantCode'])
            except Exception as exc:
                log.error("Failed to process message: %s — %s", message.value, exc)
```

---

## Expert

### Django request lifecycle

1. **WSGI/ASGI entry point** (`wsgi.py`/`asgi.py`) receives the raw HTTP request from gunicorn/uvicorn
2. **Middleware stack** processes request in order: `SecurityMiddleware` → `SessionMiddleware` → `AuthenticationMiddleware` → custom middleware. Each middleware can short-circuit and return a response
3. **URL dispatcher** (`URLconf`) matches the path and calls the matched view
4. **View** validates input (serializer), queries the ORM, and returns a `Response`
5. **Middleware stack** processes response in reverse order
6. **WSGI handler** serialises the response and writes to the socket

### Query optimisation and N+1 detection

```python
# settings.py — enable query logging in development
import logging

LOGGING = {
    'version': 1,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',
        }
    }
}

# Programmatic query inspection
from django.db import connection, reset_queries
from django.conf import settings

settings.DEBUG = True
reset_queries()

materials = list(Material.objects.select_related('vendor').filter(plant_code='PUNE'))

print(f"Queries executed: {len(connection.queries)}")
for q in connection.queries:
    print(q['time'], q['sql'][:120])
```

**N+1 problem:** Accessing `material.vendor.name` inside a loop without `select_related` fires one SQL query per material. Fix: always `select_related` for ForeignKey accessed in serializers, and `prefetch_related` for reverse FK and ManyToMany.

**EXPLAIN ANALYZE from Django:**
```python
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute(
        "EXPLAIN ANALYZE SELECT * FROM materials WHERE plant_code = %s AND stock < %s",
        ['PUNE', 100]
    )
    rows = cursor.fetchall()
    for row in rows:
        print(row[0])
```

### Coverage

```bash
pip install coverage
coverage run --source='.' manage.py test inventory
coverage report -m
coverage html    # opens htmlcov/index.html
```

---

## In the TML Codebase

**Keycloak token validation (`python-keycloak`)**
```python
# auth/backends.py
from keycloak import KeycloakOpenID
from django.conf import settings

keycloak_openid = KeycloakOpenID(
    server_url=settings.KEYCLOAK_URL,
    realm_name=settings.KEYCLOAK_REALM,
    client_id=settings.KEYCLOAK_CLIENT_ID,
    client_secret_key=settings.KEYCLOAK_CLIENT_SECRET,
)

class KeycloakAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ')[1]
        try:
            userinfo = keycloak_openid.userinfo(token)
            user, _ = User.objects.get_or_create(username=userinfo['preferred_username'])
            return (user, token)
        except Exception:
            raise AuthenticationFailed('Invalid or expired token')
```

**Kafka consumer pattern (`ep-assembly-configurator-2`)**
Long-running Kafka consumers run as Django management commands inside Docker containers. This shares the ORM, settings, and database pool with the REST API without running a separate Python process.

**`docker-compose` for local PostgreSQL**
```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: inventory
      POSTGRES_USER: tml
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
```

**XlsxWriter pattern (`pv-sadhan-logistics`)**
```python
import xlsxwriter
import io

buffer = io.BytesIO()
workbook  = xlsxwriter.Workbook(buffer, {'in_memory': True})
worksheet = workbook.add_worksheet('Logistics')
bold = workbook.add_format({'bold': True, 'bg_color': '#1F4E79', 'font_color': 'white'})
worksheet.write_row(0, 0, ['Route', 'Vehicle', 'Departure', 'Arrival', 'Status'], bold)
# ... write data rows ...
workbook.close()
buffer.seek(0)
return HttpResponse(buffer.read(), content_type='application/vnd.ms-excel')
```

**`sadhan-auto-rep-backend`**
This service combines Keycloak OIDC token validation, pandas DataFrames for stock analysis, and openpyxl for report generation in a single Django application — the canonical example of Python's data processing strengths in the TML platform.

---

## Quick Reference

### ORM method cheat sheet

| Operation                    | QuerySet method                                        |
|------------------------------|-------------------------------------------------------|
| All rows                     | `Model.objects.all()`                                 |
| Filter rows                  | `.filter(field=value)`                                |
| Exclude rows                 | `.exclude(field=value)`                               |
| Get single object            | `.get(id=1)` — raises if missing or multiple          |
| Get or None                  | `.filter(...).first()`                                |
| Count                        | `.count()`                                            |
| Exists                       | `.exists()`                                           |
| Order                        | `.order_by('field')` / `.order_by('-field')`          |
| Limit/offset                 | `[:10]` / `[10:20]`                                  |
| Follow FK (JOIN)             | `.select_related('vendor')`                           |
| Follow reverse FK            | `.prefetch_related('order_set')`                      |
| Aggregate                    | `.aggregate(total=Sum('stock'))`                      |
| Annotate per row             | `.annotate(count=Count('items'))`                     |
| Dict output                  | `.values('field1', 'field2')`                         |
| Flat list                    | `.values_list('field', flat=True)`                    |
| Update in bulk               | `.filter(...).update(field=value)`                    |
| Delete in bulk               | `.filter(...).delete()`                               |

### DRF serializer field types

| Field                  | Use case                                |
|------------------------|-----------------------------------------|
| `CharField`            | String                                  |
| `IntegerField`         | Integer                                 |
| `DecimalField`         | Decimal (specify `max_digits`, `decimal_places`) |
| `BooleanField`         | True/False                              |
| `DateTimeField`        | ISO-8601 datetime                       |
| `SerializerMethodField` | Read-only computed value               |
| `PrimaryKeyRelatedField` | FK by ID                              |
| `SlugRelatedField`     | FK by slug field                        |
| `NestedSerializer`     | Embed nested object                     |

### `manage.py` commands

```bash
manage.py runserver [port]         # dev server
manage.py makemigrations [app]     # generate migration
manage.py migrate                  # apply migrations
manage.py showmigrations           # list migration state
manage.py sqlmigrate app 0001      # show SQL for migration
manage.py shell                    # interactive Django shell
manage.py createsuperuser          # create admin user
manage.py test [app]               # run tests
manage.py collectstatic            # gather static files
manage.py dbshell                  # psql / sqlite shell
```
