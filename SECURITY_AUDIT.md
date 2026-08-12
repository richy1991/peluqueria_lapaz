# Auditoría de seguridad — LEGEND CLUB

Fecha: 12 de agosto de 2026

## Resultado ejecutivo

No se encontraron claves `sb_secret`, `service_role` ni secretos OAuth dentro del código actual, los archivos rastreados o el historial Git. Los archivos `.env*` están ignorados, salvo `.env.example` sin valores.

El identificador `ggiajbauxczmqkylvjow.supabase.co` mostrado por Google es la URL pública del proveedor OAuth, no una contraseña ni una llave. La clave `sb_publishable` también es pública por diseño. La protección de datos depende de autenticación, RLS y permisos de funciones.

Las credenciales secretas compartidas anteriormente fuera del repositorio deben considerarse comprometidas si no fueron rotadas. El checklist del proyecto indica que ya fueron rotadas, pero su estado debe confirmarse directamente en los paneles de Supabase y Google Cloud.

## Controles comprobados

- RLS habilitado en todas las tablas públicas de negocio.
- Las operaciones administrativas, de caja y peluquería validan capacidades en PostgreSQL, no solo en la interfaz.
- No existe `service_role` ni `sb_secret` en el frontend.
- `.env.local` no está rastreado por Git.
- Redirección OAuth protegida contra redirecciones externas (`//` y URL absoluta).
- Rotación de refresh tokens configurada.
- Inicio anónimo deshabilitado.
- Almacenamiento público limitado a JPG, PNG y WEBP, con máximo de 8 MB y carpetas protegidas por rol/propietario.
- Dependencias de producción: 0 vulnerabilidades conocidas según `npm audit --omit=dev`.
- Cabeceras añadidas: HSTS, `nosniff`, anti-iframe, política de referencia, permisos restringidos y COOP compatible con OAuth.

## Endurecimiento aplicado

Migración `202608120001_security_hardening.sql`:

- Ocho intentos como máximo cada diez minutos para vincular comprobantes.
- Respuesta indistinguible para código inválido, usado o temporalmente limitado.
- Seis reservas por hora por cliente.
- Diez apartados de productos por hora.
- Ocho solicitudes de canje por hora.
- Diez mensajes por minuto.
- Cierre de la inserción anónima en `web_events`, funcionalidad que no utiliza la aplicación.
- Corrección del acceso a `pgcrypto` en la generación de códigos de ventas invitadas.
- Contadores privados sin acceso para roles `anon` o `authenticated`.

## Riesgos que requieren configuración externa

### URL de Supabase visible en Google

No permite acceder por sí sola a información protegida. Para reemplazarla por una dirección de marca se requiere configurar un dominio personalizado de Supabase, por ejemplo `api.legendclub.bo`, y añadir su callback OAuth en Google Cloud. Supabase ofrece esta función como complemento de un plan de pago.

### Bots e intentos de autenticación

La aplicación utiliza exclusivamente Google OAuth; las contraseñas no se reciben ni almacenan aquí. Google y Supabase aplican sus propios controles. Se recomienda confirmar en Supabase:

1. Authentication → Bot and Abuse Protection.
2. Activar Cloudflare Turnstile o hCaptcha si se incorporan formularios compatibles de contraseña, OTP o registro.
3. Mantener el límite de `sign_in_sign_ups` y revisar eventos de Auth.

### DoS y DDoS

Vercel incluye mitigación automática DDoS. Para abuso L7 de baja intensidad se recomienda crear una regla WAF de rate limiting para `/login`, `/admin/login`, `/reservar` y `/auth/callback`, además de activar Attack Challenge Mode durante un ataque. Las solicitudes directas a Supabase quedan sujetas a sus límites de Auth, RLS y los límites de negocio agregados en PostgreSQL.

## Operación periódica recomendada

- Revisar mensualmente Supabase Security Advisor y Performance Advisor.
- Revisar Vercel Firewall y Auth Logs ante picos anormales.
- Rotar inmediatamente cualquier secreto compartido por chat, captura o correo.
- Mantener únicamente la clave publishable en `NEXT_PUBLIC_*` o en configuración pública; nunca usar allí una clave secreta.
- Probar trimestralmente la matriz RLS con cuentas cliente, peluquero, cajero, administrador y superadministrador.
- Mantener dependencias actualizadas y ejecutar `npm audit --omit=dev` antes de cada entrega.

## Limitación

Ningún cambio de aplicación puede garantizar la eliminación total de ataques DDoS distribuidos. La defensa efectiva combina controles del código, PostgreSQL/RLS, límites de Supabase y firewall de Vercel.
