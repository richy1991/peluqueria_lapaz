# Navaja — Peluquería & Barbería

Primera base funcional de la web pública y el sistema de reservas definido en `guia_de_desarrollo.md`.

## Estado actual

- Web pública responsive con servicios, equipo, galería, contacto y llamadas a la acción.
- Flujo demostrativo de reserva en cuatro pasos.
- Registro con Google simulado y claramente identificado como demo.
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
7. Reemplazar la simulación de Google y el guardado demo de citas por acciones protegidas.

No se debe colocar una clave `sb_secret_...` ni `SUPABASE_SERVICE_ROLE_KEY` en variables públicas o en el navegador.
