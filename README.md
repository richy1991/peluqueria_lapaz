# Navaja — Peluquería & Barbería

Primera base funcional de la web pública y el sistema de reservas definido en `guia_de_desarrollo.md`.

## Estado actual

- Web pública responsive con servicios, equipo, galería, contacto y llamadas a la acción.
- Flujo demostrativo de reserva en cuatro pasos.
- Cliente y callback OAuth de Google implementados; el proveedor debe habilitarse en Supabase.
- PWA básica mediante `manifest.webmanifest` e icono local.
- Esquema inicial de Supabase con RLS y prevención de solapamientos.
- Contenido e identidad ficticios, preparados para reemplazarse desde el futuro panel administrador.

Las imágenes actuales son referencias externas de demostración. No se guardarán en el código cuando exista el panel de administración.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Configurar Supabase más adelante

1. Crear un proyecto en Supabase.
2. Copiar `.env.example` como `.env.local` y completar la URL y la clave publicable.
3. Configurar Google como proveedor de autenticación.
4. Aplicar `supabase/migrations/202608080001_initial_core.sql` mediante Supabase CLI.
5. Crear buckets separados para contenido público y referencias privadas.
6. Sustituir `lib/demo-data.ts` por consultas al backend.
7. Reemplazar el guardado demo de citas por una acción protegida y transaccional.

No se debe colocar una clave `sb_secret_...` ni `SUPABASE_SERVICE_ROLE_KEY` en variables públicas o en el navegador.

## Activar el acceso con Google

El callback OAuth y la persistencia de la selección de reserva ya están implementados. Falta habilitar el proveedor:

1. Crear credenciales OAuth 2.0 de tipo **Aplicación web** en Google Cloud.
2. Registrar como URI de redirección autorizada de Google:
   `https://ggiajbauxczmqkylvjow.supabase.co/auth/v1/callback`
3. En Supabase, abrir **Authentication > Providers > Google**, habilitarlo y guardar allí el Client ID y Client Secret.
4. En **Authentication > URL Configuration**, agregar para desarrollo:
   `http://localhost:3000/auth/callback`
5. Al desplegar, agregar también `https://TU_DOMINIO/auth/callback` y configurar el Site URL de producción.

El Client Secret de Google debe guardarse únicamente en Google/Supabase; no pertenece a `.env.local` ni al repositorio.
