# LEGEND CLUB Mobile

Aplicación Expo para Android y Huawei. Los módulos de cliente y peluquero se muestran dentro de la app desde el mismo sitio web responsivo, por lo que usan las mismas páginas, estilos, animaciones, reservas y funciones. La sesión y los datos se comparten con Supabase.

## Módulos incluidos

- **Cliente:** se carga el portal web `mi-cuenta`, incluida la reserva, citas, catálogo, puntos, QR de recomendación, perfil, notificaciones, galería y chat.
- **Peluquero:** se carga el portal web `barbero`, incluida la agenda, acciones de citas, catálogo, perfil público, trabajos y balance.
- **Acceso:** se solicita el correo y se valida con un código dentro de la app. Las cuentas administrativas y de caja reciben el aviso para usar la versión web.
- **Contenido:** se comparte en tiempo real con el sitio público y Supabase.

Las fotos del perfil y de la galería se reducen a un máximo de 1600 px, se convierten a WebP y se guardan en el bucket `public-media` existente.

## Configuración local

1. Instala Node.js 22.13 o posterior.
2. Desde esta carpeta ejecuta `npm install`.
3. Copia `.env.example` a `.env` si necesitas cambiar el proyecto de Supabase o el dominio público.
4. En Supabase, habilita Email como proveedor y edita la plantilla **Magic Link** para incluir `{{ .Token }}` (código de acceso). La plantilla no debe depender únicamente de `{{ .ConfirmationURL }}`, porque el código se introduce dentro de la app.
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
