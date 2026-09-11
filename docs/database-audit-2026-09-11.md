# Auditoría de esquema y duplicación

Fecha: 2026-09-11

## Alcance

Se cruzaron las 47 tablas declaradas por las migraciones con:

- consultas directas del frontend;
- funciones RPC vigentes;
- triggers, políticas RLS y claves foráneas;
- funciones de compatibilidad e historial de ventas.

Una tabla sin una llamada `.from()` no se consideró automáticamente huérfana. En
este proyecto varias tablas son detalles internos de operaciones atómicas y solo
las utilizan funciones de PostgreSQL.

## Objetos retirados

- `feature_flags`: nunca tuvo consumidor en frontend, RPC, trigger ni tarea.
- `customer_streaks`: racha global sustituida por
  `customer_barber_streaks`; la función vigente procesa las rachas por
  peluquero.
- Nueve firmas RPC antiguas, revocadas o reemplazadas por las versiones actuales
  de productos, caja, fidelidad, gastos, liquidaciones y galería.

La migración usa firmas exactas y no usa `CASCADE`. Si el servidor encuentra una
dependencia no inventariada, debe abortar antes de eliminar un objeto activo.

## Objetos parecidos que se conservan

- `business_hours` define el horario general del local; `schedules` define la
  disponibilidad de cada peluquero. Ambas participan en `get_available_slots`.
- `loyalty_accounts` conserva saldos históricos globales necesarios para revertir
  ventas antiguas; `customer_barber_loyalty_accounts` es el libro vigente por
  peluquero.
- `conversation_participants`, `payout_items`, `audit_logs`, `claim_attempts`,
  `referrals`, `pending_*`, `schedule_exceptions` y `web_events` no siempre se
  consultan directamente desde React, pero sostienen autorización, trazabilidad,
  liquidaciones, agenda o analítica mediante PostgreSQL.
- `create_daily_barber_payout` y `register_counter_service_sale_v4` permanecen
  como adaptadores de compatibilidad documentados; las operaciones nuevas usan
  sus versiones actuales.

## Optimizaciones aplicadas

- Índices compuestos en agenda, apartados, notificaciones, fidelidad, ventas,
  liquidaciones, chat, galería y auditoría, siguiendo los filtros y ordenamientos
  reales de los paneles.
- Conversión de fechas centralizada mediante zona IANA. Se eliminó la mezcla entre
  hora local del servidor, zona del negocio y el desplazamiento fijo `-04:00`.
- Carga y optimización de imágenes centralizada. Los lotes fallidos limpian los
  archivos ya subidos para no dejar objetos huérfanos.
- Construcción de URLs públicas de imágenes centralizada y sin duplicados.

## Criterio para futuras eliminaciones

Antes de retirar una tabla o función hay que revisar frontend, RPC, triggers,
políticas, claves foráneas, tareas programadas y datos históricos. Las eliminaciones
deben publicarse en una migración nueva, sin reescribir migraciones ya aplicadas y
sin `CASCADE` salvo que exista un inventario explícito de todas las dependencias.
