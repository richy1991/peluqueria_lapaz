# LEGEND CLUB Mobile

Aplicación React Native con Expo, independiente del sitio Next.js. La app reutiliza el proyecto y la sesión de Supabase existentes; la web actual sigue disponible y los datos se comparten entre ambas.

## Módulos incluidos

- **Cliente:** próxima cita y sus acciones, catálogo, carrito y apartados, puntos por peluquero, código QR de recomendación, vinculación de comprobantes, perfil, notificaciones, preferencias y chat.
- **Peluquero:** agenda de hoy y semanal, inicio de atención, inasistencia, envío a caja, catálogo, perfil público, publicación de trabajos y balance.
- **Reserva nativa:** el cliente elige servicio, peluquero, día y horario, registra su teléfono y confirma las condiciones dentro del APK. La disponibilidad usa la agenda y las reglas actuales de Supabase.
- **Sitio público:** los accesos abren la web actual en `EXPO_PUBLIC_SITE_URL`; su contenido se sigue administrando desde la web.

Las fotos del perfil y de la galería se reducen a un máximo de 1600 px, se convierten a WebP y se guardan en el bucket `public-media` existente.

## Configuración local

1. Instala Node.js 22.13 o posterior.
2. Desde esta carpeta ejecuta `npm install`.
3. Copia `.env.example` a `.env` si necesitas cambiar el proyecto de Supabase o el dominio público.
4. Configura la plantilla **Authentication → Email → Magic Link** de Supabase para incluir `{{ .Token }}`. La app solicita y verifica este código dentro de la app; no abre el navegador. Las cuentas de cliente y peluquero acceden a sus respectivos módulos. Administración y caja deben usar la web.
5. Ejecuta `npx expo start` y abre la app en un development build.

El endpoint y la publishable key incluidos como respaldo son públicos, igual que en la web. No uses una clave `service_role` ni una `sb_secret` en esta app.

## Crear compilaciones

Vincula esta app a una cuenta de Expo EAS una vez:

```sh
npx eas-cli@latest login
npx eas-cli@latest init
```

APK instalable para Android o Huawei:

```sh
npx eas-cli@latest build --platform android --profile huawei
```

La misma APK se puede instalar directamente en teléfonos Huawei. Para distribuirla por AppGallery, sube la APK firmada desde la cuenta de desarrollador de Huawei y completa su revisión.

Compilación iOS:

```sh
npx eas-cli@latest build --platform ios --profile production
```

La instalación y publicación de iOS necesita las credenciales de firma de Apple; una distribución de prueba se realiza desde TestFlight. EAS compila iOS en la nube, por lo que esta app no necesita una carpeta `ios/` creada a mano.

## Descargar el APK desde GitHub

Compila la versión móvil actual con EAS y publica el artefacto desde GitHub Actions:

1. Desde `apps/mobile`, ejecuta `npx eas-cli@latest build --platform android --profile huawei --non-interactive --wait`.
2. Copia el enlace del APK que empieza con `https://expo.dev/artifacts/eas/` desde el resultado o el detalle de la compilación.
3. En GitHub abre **Actions → Publicar APK de LEGEND CLUB → Run workflow**, pega ese enlace en `expo_artifact_url` y ejecuta el workflow.
4. Cuando termine, la nueva APK quedará publicada en **Releases**.

El sitio público usa el enlace estable `https://github.com/richy1991/peluqueria_lapaz/releases/latest/download/legend-club-android.apk`, que siempre dirige a la última publicación. El repositorio debe ser público para que clientes y barberos puedan descargar sin iniciar sesión. El mismo APK se instala en Android y Huawei; iOS necesita su propia compilación y no puede instalar archivos APK.

## Notificaciones push

El centro de avisos, el estado leído y las preferencias se comparten con la web. Las notificaciones push del sistema todavía requieren configurar un emisor y las credenciales de APNs/FCM; Huawei sin Google Play Services requiere además su integración HMS. La app no anuncia push como activo hasta que esos servicios estén configurados.
