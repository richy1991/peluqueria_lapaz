# Navaja — Peluquería & Barbería

Primera base funcional de la web pública y el sistema de reservas definido en `guia_de_desarrollo.md`.

## Estado actual

- Web pública responsive con servicios, equipo, galería, contacto y llamadas a la acción.
- Flujo real de reserva en cuatro pasos con disponibilidad y protecciones transaccionales.
- Cliente y callback OAuth de Google implementados y conectados con Supabase Auth.
- PWA básica mediante `manifest.webmanifest` e icono local.
- Esquema versionado de Supabase con RLS y prevención de solapamientos.
- Servicios, profesionales, estado del negocio, galería y productos cargados desde Supabase.
- Panel protegido en `/admin` para contenido público, servicios, galería y productos.
- Storage público con carga administrativa y optimización de imágenes en el navegador.
- Apartado de productos durante 24 horas para clientes autenticados.

Las imágenes iniciales son referencias externas de demostración. Las nuevas publicaciones del administrador se guardan optimizadas en Supabase Storage.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Configuración de producción

1. Copiar `.env.example` como `.env.local` y completar la URL y la clave publicable.
2. Configurar las mismas variables `NEXT_PUBLIC_*` en Vercel para Production.
3. Configurar Google como proveedor de autenticación.
4. Aplicar las migraciones con `supabase db push`.
5. Iniciar sesión una vez y asignar `admin` al usuario autorizado en `user_roles`.

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
