# Módulos móviles

`client` y `barber` son aplicaciones móviles independientes dentro del proyecto web. Las carpetas de `app/` solo declaran rutas de Next.js y delegan la experiencia a estos módulos.

## Límites

- `contracts.ts` contiene tipos y navegación sin dependencias de React ni Next. Es la primera capa reutilizable en React Native.
- Las vistas principales son adaptadores web. Actualmente consultan Supabase desde el servidor de Next.
- Cada módulo conserva sus propias acciones y una entrada de estilos móvil. El módulo de peluquero todavía usa reglas base del panel web como adaptador temporal.
- Administración y caja permanecen en `app/admin` y `app/caja`, orientados a escritorio.

## Migración a React Native

La futura APK debe reutilizar contratos y modelos, crear componentes nativos propios y consumir una API autenticada. No debe importar archivos de `app/`, componentes HTML ni el cliente Supabase de servidor.
