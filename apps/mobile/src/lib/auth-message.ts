export function authErrorMessage(reason: unknown, fallback: string) {
  const message = reason instanceof Error ? reason.message : fallback;
  const normalized = message.toLowerCase();
  const code = reason && typeof reason === 'object' && 'code' in reason
    ? String((reason as { code?: unknown }).code ?? '').toLowerCase()
    : '';

  if (code === 'developer_error' || normalized.includes('[developer_error]')) {
    return 'Google rechazó la configuración de la app. Verifica el ID OAuth web, el paquete y SHA-1 de Android, y el esquema de retorno de iOS.';
  }
  if (code === 'play_services_not_available') {
    return 'Google Play Services no está disponible o necesita actualizarse en este teléfono.';
  }
  if (code === 'in_progress') {
    return 'Google ya está abriendo el acceso. Espera un momento e inténtalo de nuevo.';
  }
  if (code === 'one_tap_start_failed') {
    return 'Google no pudo abrir la selección de cuenta. Comprueba tu conexión e inténtalo de nuevo.';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'El correo o la contraseña de LEGEND CLUB no coinciden. Si creaste tu cuenta con Google, usa Google o toca «¿Olvidaste tu contraseña?» para crear una contraseña de la app.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirma tu correo desde el enlace que te enviamos antes de iniciar sesión.';
  }
  if (normalized.includes('user already registered')) {
    return 'Si ya tienes una cuenta, inicia sesión con ese correo.';
  }
  if (normalized.includes('email_exists') || normalized.includes('user_already_exists')) {
    return 'Ese correo ya tiene una cuenta. Inicia sesión en lugar de crear otra.';
  }
  if (normalized.includes('password') && (normalized.includes('at least') || normalized.includes('minimum length'))) {
    return 'La contraseña es demasiado corta. Usa al menos 8 caracteres.';
  }
  if (normalized.includes('provider') && (normalized.includes('not enabled') || normalized.includes('disabled'))) {
    return 'El acceso con Google todavía no está habilitado en Supabase.';
  }
  if (normalized.includes('invalid') && (normalized.includes('otp') || normalized.includes('token'))) {
    return 'El código no es válido o ya venció. Solicita uno nuevo.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many') || normalized.includes('security purposes') || normalized.includes('after 60 seconds')) {
    return 'Espera un minuto antes de solicitar otro código.';
  }
  if (normalized.includes('email address not authorized') || normalized.includes('smtp') || normalized.includes('email provider')) {
    return 'Supabase no pudo enviar el correo. Configura un SMTP verificado o inténtalo más tarde.';
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'No pudimos conectar. Revisa tu internet e inténtalo otra vez.';
  }
  if (normalized.includes('email') && normalized.includes('invalid')) {
    return 'Revisa que el correo esté escrito correctamente.';
  }
  if (normalized.includes('redirect') || normalized.includes('url not allowed')) {
    return 'Google no pudo volver a la app. Revisa la configuración de acceso e inténtalo otra vez.';
  }
  if (normalized.includes('code verifier') || normalized.includes('pkce')) {
    return 'Google volvió a la app, pero no se pudo recuperar la sesión. Vuelve a intentarlo.';
  }
  return message;
}
