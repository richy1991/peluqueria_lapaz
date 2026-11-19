# Autenticación de la app móvil

La app ofrece Google nativo y acceso con correo y contraseña. Supabase mantiene un solo usuario por correo; si el registro responde que ese correo ya existe, la app muestra el acceso en vez de indicar que creó otra cuenta. El trigger `handle_new_user` crea el perfil de cliente y, tras el primer acceso, la app solicita nombre completo y teléfono antes de abrir las pantallas del cliente.

Para que el registro con contraseña inicie sesión inmediatamente, desactiva **Confirm email** en **Supabase Dashboard → Authentication → Sign In / Providers → Email**. La configuración local del proyecto ya tiene las confirmaciones desactivadas. Si las mantienes activas en el proyecto alojado, Supabase no entrega una sesión hasta verificar el correo y el cliente debe abrir el enlace recibido antes de continuar.

## Google nativo

Expo Go no puede cargar este modulo nativo. Para probar el mismo acceso Google y seguir viendo cambios de JavaScript en tiempo real, instala una compilacion de desarrollo una vez:

```bash
npx eas-cli@latest build --profile development --platform android
npm run start:dev-client
```

Instala el APK de desarrollo en el telefono y abre LEGEND CLUB conectado al servidor Metro. La recarga rapida sigue funcionando; solo necesitas reconstruir al cambiar dependencias o configuracion nativa.

El APK debe generarse después de instalar `react-native-nitro-google-signin` y `react-native-nitro-modules`; el bundle de JavaScript por sí solo no incluye estos módulos nativos.

Para generar el APK interno configurado en `eas.json`, ejecuta `npx eas-cli@latest build --profile preview --platform android` y luego instala el APK nuevo en el teléfono.

La integración usa Android Credential Manager y el SDK nativo de Google en iOS. Necesita un APK/IPA de desarrollo o distribución; Google nativo no funciona dentro de Expo Go.

En Google Cloud Console crea o reutiliza estos clientes OAuth:

- **Web**: usa el cliente configurado como proveedor Google en Supabase.
- **Android**: paquete `com.legendclub.barberia`, con las huellas SHA-1 de la clave de desarrollo/preview y de Google Play si distribuyes por Play Store.
- **iOS**: bundle ID `com.legendclub.barberia`.

El ID OAuth de tipo Web de este proyecto está incluido como identificador público predeterminado para que Android funcione también en compilaciones de EAS sin variables remotas. Si usas otro proyecto OAuth, puedes sobrescribirlo con `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` en `apps/mobile/.env` o en el entorno de EAS.

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps...
```

El esquema de iOS es el `REVERSED_CLIENT_ID` del cliente OAuth de iOS. Los IDs OAuth son identificadores públicos de la aplicación; no pongas aquí el secreto OAuth web ni la clave `service_role` de Supabase. `app.config.ts` usa el esquema para completar el config plugin durante la compilación.

Para iOS, añade `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` y `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` en los entornos de EAS **preview** y **production**. Después genera e instala una compilación nueva: los valores `EXPO_PUBLIC_*` se incorporan al bundle de la app.

En **Supabase Dashboard → Authentication → Sign In / Providers → Google**, conserva habilitado Google y registra los tres Client IDs en este orden: web, Android e iOS (separados por comas); conserva el secreto del cliente web solo en Supabase. El inicio nativo entrega a Supabase el ID token emitido por Google, así que no necesita abrir el navegador ni una URL de retorno OAuth. El flujo genera y valida un nonce por acceso; deja desactivada la opción **Skip nonce check**.

## Correo, confirmación y recuperación

En **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**, permite estas dos URLs:

```text
legendclub://auth/callback
legendclub://auth/reset-password
```

Para probar confirmación y recuperación desde **Expo Go**, agrega también `exp://**` a Redirect URLs. La app genera la ruta `exp://.../--/auth/callback` o `exp://.../--/auth/reset-password` según el servidor Metro activo. Mantén esta regla solo para el proyecto de desarrollo; usa las rutas `legendclub://` en los builds instalados.

La app confirma nuevas cuentas mediante el enlace de Supabase y ofrece recuperación de contraseña. En **Authentication → Email Templates**, usa `../../supabase/templates/auth_otp.html` para **Confirm signup** y **Magic Link**: incluye `{{ .ConfirmationURL }}` para abrir la app y `{{ .Token }}` como alternativa de código. La plantilla local no actualiza por sí sola las plantillas del proyecto alojado.

Una cuenta creada con Google no tiene la misma contraseña que Google en Supabase. Para probar correo con ese mismo email, abre **Iniciar sesión → ¿Olvidaste tu contraseña?**, solicita el enlace y guarda una contraseña de LEGEND CLUB. Después podrás probar el acceso por correo. Para probar Google nativo, Expo Go no sirve: hace falta instalar una compilación de desarrollo.

Para que los correos lleguen a clientes externos, configura un SMTP propio en Supabase y confirma un remitente verificado. El SMTP predeterminado gratuito tiene límites para los destinatarios y no está pensado para entregar mensajes a todos los clientes.

Si la confirmación de correo está activa, el cliente debe tocar el enlace de confirmación una vez; Supabase devolverá la sesión a la app y continuará con el perfil. Los accesos posteriores no requieren códigos ni nuevos enlaces.

## Confirmacion de sesion de Google

El unico flujo para Google nativo es Google SDK → ID token con nonce → supabase.auth.signInWithIdToken. Supabase valida el token y crea la sesion persistente de la app; necesita internet para completar ese intercambio. Google como proveedor social esta incluido en el plan Free, sin Edge Function ni servicio de autenticacion adicional.
