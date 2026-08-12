OBJETIVO DEL SISTEMA
Desarrollar un sistema web movil, instalable como PWA, para una peluqueria pequena, enfocado en:
Atraer mas clientes.
Mantener a los clientes mejor informados.
Organizar mejor el servicio.
Gestionar reservas y agenda de peluqueros.
Mostrar catalogo de trabajos, estilos y productos.
Permitir comunicacion interna mediante chat de texto.
Enviar notificaciones internas dentro del sistema.
Administrar servicios, peluqueros, productos, galeria y estado del negocio.
La V1 original no manejaba pagos online, caja ni contabilidad. El cambio de alcance aprobado el 9 de agosto de 2026 incorpora caja operativa, fidelizacion y comisiones por etapas, pero mantiene fuera los pagos online y la contabilidad fiscal completa.
ALCANCE GENERAL DE LA PRIMERA VERSION
El sistema incluira:
Autenticacion con Google.
Registro automatico de clientes.
Roles: cliente, peluquero, administrador y superadmin.
Panel administrador.
Vista peluquero.
Vista cliente.
Selector de modo para usuarios con multiples capacidades.
Agenda por peluquero.
Reservas de citas.
Servicio a domicilio con solicitud y aprobacion manual.
Estado del negocio en tiempo real o casi inmediato.
Catalogo publico de servicios.
Galeria de trabajos publicados por el administrador.
Catalogo simple de productos.
Apartado de productos por 24 horas.
Notificaciones internas.
Chat interno solo texto.
Anuncios de actualizaciones del sistema.
Registro rapido para clientes sin cita, incentivando instalacion/registro.
Optimizacion de imagenes.
Auditoria de acciones administrativas.
La V1 original no incluia:
Pagos online.
Pasarelas de pago.
Caja.
Contabilidad.
Facturacion electronica.
SMS automaticos.
WhatsApp API de pago.
Email transaccional obligatorio.
Chat con imagenes.
Sistema complejo de fidelizacion.
Sistema complejo de comisiones.
Multi-sucursal.
DECISIONES CLAVE APROBADAS
3.1 Infraestructura
Backend: Supabase.
Frontend: React desplegado en Vercel.
Se recomienda Next.js sobre Vercel por SEO y rendimiento para la parte publica.
Autenticacion: Supabase Auth con Google.
Almacenamiento de imagenes: Supabase Storage.
Notificaciones: internas dentro del sistema.
No se contrataran APIs de mensajeria de pago en esta version.
Las cuentas de infraestructura, repositorio y despliegue seran administradas por el desarrollador.
La peluqueria usara el sistema como servicio.
Los administradores del negocio seran usuarios invitados dentro del sistema.
3.2 Administradores
Habra 2 administradores.
Ambos tendran los mismos accesos y permisos operativos.
Esto permite que si uno pierde acceso, el otro pueda hacerse cargo.
El desarrollador registrara/activara a los administradores.
El desarrollador tendra acceso superadmin tecnico.
Se debe registrar auditoria de acciones administrativas.
El sistema debe evitar bloqueos accidentales, por ejemplo:
Un administrador no debe poder desactivar su propia cuenta.
No debe quedar cero administradores activos.
3.3 Peluqueros
Los peluqueros seran registrados por el administrador.
El administrador ingresara sus datos.
Si el peluquero ya existe como cliente, el administrador puede buscarlo y convertirlo en peluquero.
Si no existe, el administrador puede pre-registrarlo con su correo.
Luego el peluquero debera iniciar sesion con Google usando el mismo correo.
No se borraran peluqueros.
Los peluqueros se desactivan, no se eliminan.
3.4 Cliente
Los clientes se registran solos con Google.
Todo usuario nuevo entra inicialmente como cliente.
Para reservar, el cliente debera tener telefono registrado.
Si ya tiene telefono, debera confirmarlo antes de reservar.
Un mismo numero de telefono puede estar asociado a maximo 3 cuentas activas.
Si supera el limite, el administrador debera dar de baja alguna cuenta antigua.
El cliente puede silenciar notificaciones, con excepcion de avisos criticos mostrados dentro de la app.
3.5 Dueno / administrador / peluquero
Un administrador puede tambien ser peluquero.
La cuenta base puede tener rol administrativo.
Ademas puede tener un perfil de peluquero activo.
Si el usuario es administrador y peluquero, vera selector de modo.
La vista prioritaria por defecto para administradores con perfil de peluquero sera:
MODO PELUQUERO.
El usuario podra cambiar manualmente a:
Modo peluquero.
Modo administrador.
Modo cliente / vista previa.
3.6 Reservas
El precio de la cita se mantiene aunque el servicio cambie de precio despues.
La duracion de los servicios la define manualmente el administrador.
Habra un buffer de 5 minutos entre citas.
Habra tiempo de gracia configurable por servicio.
Si el cliente avisa retraso por chat, se puede esperar su llegada.
Si no avisa y pasa el tiempo de gracia, puede marcarse como no asistio.
Tres inasistencias colocan al cliente en lista negra.
La lista negra no bloquea automaticamente.
El bloqueo sera manual y solo si hay reincidencia.
La cancelacion online debera hacerse con minimo 2 horas de anticipacion.
Cancelaciones con menos de 2 horas se gestionaran manualmente.
El sistema limitara reservas para evitar spam.
3.7 Walk-in / clientes sin cita
Se permitira registro rapido interno si es necesario.
Pero el sistema incentivara al cliente a instalar/registrarse en la app.
El registro rapido no debe reemplazar el registro normal, solo resolver atencion inmediata.
3.8 Ausencias y emergencias
Se podran marcar feriados, vacaciones, ausencias y emergencias.
Si un peluquero se desactiva o falta, las reservas futuras deberan reasignarse.
La reasignacion debera ser confirmada por el cliente.
Si la peluqueria cierra por emergencia:
La app mostrara estado cerrado.
El administrador debera reprogramar las reservas afectadas.
Se notificara al cliente con justificacion.
El administrador podra apoyarse manualmente en WhatsApp.
3.9 Fotos y galeria
La galeria sera gestionada solo por el administrador.
Solo se publicaran fotos autorizadas por el cliente.
No se publicaran fotos de todos los clientes.
Se publicaran principalmente trabajos destacados o disenos innovadores.
Si un cliente retira autorizacion, la publicacion debera poder ocultarse o eliminarse.
Las imagenes se subiran comprimidas y optimizadas.
No se guardaran imagenes en base de datos.
No se cifraran imagenes como texto.
3.10 Productos
El administrador publicara productos.
Cada producto tendra stock simple.
El cliente podra apartar productos.
El apartado durara 24 horas.
Si no recoge el producto, el apartado expira.
El inventario sera basico.
No se manejara caja ni contabilidad.
3.11 Notificaciones
Las notificaciones seran internas dentro del sistema.
No se usara push externo, email externo ni SMS externo como requisito.
El cliente podra silenciar notificaciones promocionales o secundarias.
Las notificaciones criticas de citas, cancelaciones, reprogramaciones o cierres deberan mostrarse dentro de la app.
Las actualizaciones del sistema se notificarann mediante anuncios internos.
3.12 Chat
El chat sera solo texto.
No permitira imagenes en esta version.
Se usara para comunicacion entre cliente, peluquero y/o administrador.
Debe incluir limites anti-spam.
Puede usarse para confirmar asistencia.
3.13 Menores de edad
La peluqueria atiende ninos.
La reserva normalmente la realizara el padre o tutor.
Se debera guardar:
Nombre del menor.
Nombre del tutor.
Telefono del tutor.
Consentimiento del tutor.
Para publicar fotos de menores se requerira autorizacion explicita del representante.
ROLES Y PERMISOS
4.1 Roles
CLIENTE
Puede ver catalogo publico.
Puede registrarse con Google.
Puede reservar.
Puede ver sus citas.
Puede recibir notificaciones internas.
Puede chatear.
Puede apartar productos.
Puede ver galeria y productos.
BARBERO
Puede ver su agenda.
Puede ver citas asignadas.
Puede ver referencias de corte.
Puede marcar estados de cita.
Puede chatear con clientes relacionados a sus citas.
Puede notificar retraso o confirmacion.
ADMINISTRADOR
Puede gestionar servicios.
Puede gestionar peluqueros.
Puede gestionar clientes.
Puede gestionar agenda general.
Puede abrir/cerrar negocio.
Puede gestionar galeria.
Puede gestionar productos.
Puede gestionar promociones basicas o anuncios.
Puede reasignar citas.
Puede cancelar/reprogramar citas.
Puede marcar feriados/vacaciones/ausencias.
Puede dar de baja clientes.
Puede bloquear manualmente usuarios reincidentes.
Puede ver auditoria basica.
SUPERADMIN
Rol tecnico del desarrollador.
Puede dar soporte.
Puede crear/activar administradores iniciales.
Puede configurar feature flags.
Puede revisar errores.
No debe ser un rol operativo diario del negocio.
Sus acciones deben quedar auditadas.
4.2 Reglas de permisos
Ningun usuario puede asignarse roles superiores a si mismo.
El cambio de rol debe hacerse mediante funcion protegida en backend.
El frontend no debe modificar roles directamente.
Las vistas deben ocultarse segun rol, pero la validacion real debe estar en backend.
Un usuario puede tener capacidad de peluquero aunque sea administrador.
La capacidad de peluquero se definira por un perfil de peluquero activo, no solo por el rol base.
AUTENTICACION Y RECUPERACION DE ACCESO
5.1 Login
Login principal: Google OAuth mediante Supabase Auth.
No se manejaran contrasenas propias del sistema.
Al iniciar sesion por primera vez, se crea automaticamente un perfil con rol cliente.
5.2 Recuperacion
Si un usuario olvida su contrasena, debera recuperar su cuenta de Google.
El sistema mostrara ayuda:
"Iniciaste sesion con Google. Si olvidaste tu contrasena, recupera tu cuenta de Google."
Se puede incluir enlace a recuperacion de Google.
Para trabajadores, el administrador puede ayudar con verificacion manual.
5.3 Telefono
El telefono no se verificara con OTP en esta version.
El telefono sera un dato confirmado por el usuario.
Antes de reservar:
Si no tiene telefono, debera ingresarlo.
Si ya tiene telefono, debera confirmar que sigue siendo correcto.
Se guardara:
phone
phone_normalized
phone_confirmed_at
5.4 Limite de cuentas por telefono
Un mismo telefono puede tener maximo 3 cuentas activas.
Si un usuario pierde acceso y se registra con otro correo, puede usar el mismo telefono.
Si ya existen 3 cuentas activas con ese telefono, el sistema bloqueara el registro.
Mensaje sugerido:
"Este numero ya esta asociado a varias cuentas. Contacta al negocio para liberar una cuenta antigua."
El administrador puede dar de baja una cuenta antigua.
Dar de baja no significa borrar fisicamente.
Se usara estado deactivated.
MODOS DE VISTA PARA USUARIOS CON MULTIPLES CAPACIDADES
6.1 Selector de modo
Un usuario que sea administrador y ademas peluquero vera un selector visible:
Modo Peluquero
Modo Admin
Modo Cliente / Vista previa
6.2 Modo por defecto
Si un administrador tiene perfil activo de peluquero:
La vista por defecto sera MODO PELUQUERO.
Esto se debe a que la prioridad operativa diaria es la agenda.
6.3 Modo peluquero
Muestra:
Agenda del dia.
Proxima cita.
Citas pendientes.
Referencias de corte.
Estado de citas.
Chat relacionado.
Acciones rapidas:
Iniciar cita.
Completar cita.
Marcar no asistio.
Marcar retraso.
Contactar cliente.
6.4 Modo administrador
Muestra:
Dashboard del negocio.
Citas del dia.
Servicios.
Peluqueros.
Clientes.
Productos.
Galeria.
Estado del negocio.
Notificaciones.
Configuraciones.
6.5 Modo cliente / vista previa
Permite ver la experiencia del cliente:
Pagina informativa.
Estado del negocio.
Servicios.
Galeria.
Productos.
Promociones/anuncios.
Flujo de reserva.
Recomendacion:
Puede ser una vista previa para administradores.
Debe mostrar indicador:
"Vista previa como cliente".
MODULO DE USUARIOS Y PERFILES
7.1 Datos base de usuario
id
email
full_name
phone
phone_normalized
phone_confirmed_at
birthday
address
role
status
no_show_count
late_cancel_count
is_blacklisted
blacklist_reason
is_blocked
blocked_reason
blocked_by
blocked_at
marketing_consent
photo_consent
created_at
updated_at
7.2 Estados de usuario
active
inactive
deactivated
suspended
7.3 Roles base
client
barber
admin
superadmin
Nota:
Para esta version, se puede simplificar usando admin como maximo rol del negocio y superadmin como rol tecnico.
7.4 Perfil de peluquero
Tabla barber_profiles:
id
user_id
display_name
bio
photo_url
specialties
commission_percent
active
created_at
updated_at
Un usuario es peluquero si:
Tiene registro en barber_profiles.
barber_profiles.active = true.
7.5 Conversion de cliente a peluquero
Flujo:
Administrador busca cliente por nombre, correo o telefono.
Abre detalle del cliente.
Presiona "Convertir en peluquero".
Completa datos de peluquero:
Nombre publico.
Especialidades.
Foto.
Servicios asignados.
Horario.
Comision opcional.
Sistema crea barber_profile.
Si el usuario era client, puede cambiar role a barber.
Si el usuario ya era admin, mantiene role admin.
Se registra auditoria.
Se notifica internamente al usuario.
MODULO DE SERVICIOS
8.1 Datos del servicio
id
name
description
category_id
price
duration_minutes
grace_minutes
image_path
thumbnail_path
active
home_service_allowed
requires_reference
gender_tag
created_at
updated_at
8.2 Reglas
Los servicios no se borran.
Se desactivan o archivan.
El administrador define la duracion manualmente.
El precio puede cambiar, pero las citas existentes conservan price_snapshot.
Cada servicio puede tener tiempo de gracia propio.
Se puede marcar si aplica servicio a domicilio.
8.3 Estados
active
inactive
archived
MODULO DE PELUQUEROS
9.1 Datos del peluquero
id
user_id
display_name
bio
photo_url
specialties
commission_percent
active
9.2 Servicios asignados
Tabla barber_services:
barber_id
service_id
9.3 Horarios
Tabla schedules:
id
barber_id
weekday
start_time
end_time
active
9.4 Excepciones
Tabla schedule_exceptions:
id
barber_id nullable
type
reason
start_at
end_at
created_by
created_at
Tipos de excepcion:
holiday
vacation
absence
emergency
maintenance
9.5 Reglas
Los peluqueros no se borran.
Se pueden desactivar.
Al desactivar, se deben listar citas futuras afectadas.
Las citas afectadas deberan reasignarse o reprogramarse.
La reasignacion debera ser confirmada por el cliente.
MODULO DE AGENDA Y DISPONIBILIDAD
10.1 Disponibilidad
El sistema calculara horarios disponibles considerando:
Horario laboral del peluquero.
Servicios asignados al peluquero.
Duracion del servicio.
Buffer entre citas.
Citas ya existentes.
Excepciones de horario.
Feriados.
Vacaciones.
Ausencias.
Estado del negocio.
Anticipacion minima de reserva.
10.2 Buffer
Buffer por defecto: 5 minutos.
Configurable en settings.
Se aplica entre citas para limpieza/preparacion.
10.3 Tiempo de gracia
Cada servicio puede tener grace_minutes.
Si no se define, usar valor global por defecto.
Ejemplo:
Corte clasico: 10 minutos.
Tinte: 15 minutos.
10.4 Evitar solapamientos
El sistema debe impedir dos citas activas para el mismo peluquero en rango de tiempo superpuesto.
Se recomienda usar rango de tiempo en PostgreSQL y constraint de exclusion.
MODULO DE RESERVAS
11.1 Datos de cita
id
client_id
barber_id
service_id
date
start_time
end_time
duration_snapshot
price_snapshot
service_name_snapshot
appointment_type
status
address
location_reference
reference_image_path
notes
is_delayed
delay_note
no_show
reassigned_from_barber_id
emergency_reason
client_confirmation_status
created_at
updated_at
11.2 Tipos de cita
in_shop
home_service
walk_in
11.3 Estados de cita
requested
pending_client_confirmation
confirmed
in_progress
completed
canceled
no_show
needs_reschedule
11.4 Reserva en local
Flujo:
Cliente elige servicio.
Elige peluquero o asignacion automatica.
Elige fecha/hora disponible.
Confirma telefono.
Puede subir referencia si el servicio lo amerita.
Confirma reserva.
Sistema crea cita.
Se muestra en agenda.
Se genera notificacion interna.
11.5 Reserva a domicilio
El cliente debe solicitarla con anticipacion minima configurable.
Debe incluir:
Servicio.
Direccion.
Referencia de ubicacion.
Foto/referencia de corte.
Telefono confirmado.
El administrador debe aprobar o rechazar.
El administrador asigna peluquero.
El estado puede ser:
requested
confirmed
assigned
in_route
completed
canceled
11.6 Precio snapshot
Al crear la cita:
Se guarda el precio del servicio en ese momento.
Si el servicio cambia de precio despues, la cita mantiene su precio original.
11.7 Duracion snapshot
Al crear la cita:
Se guarda la duracion del servicio en ese momento.
Si el administrador cambia la duracion despues, la cita existente no se afecta.
REGLAS DE CANCELACION, RETRASO Y NO SHOW
12.1 Cancelacion
El cliente puede cancelar online solo si faltan minimo 2 horas.
Si faltan menos de 2 horas:
El sistema no permite cancelacion automatica.
Muestra mensaje de contacto.
Puede mostrar boton manual de WhatsApp.
12.2 Retraso
Si el cliente avisa retraso por chat:
El peluquero puede marcar is_delayed = true.
Se guarda delay_note.
Se espera al cliente.
12.3 No show
Si pasa el tiempo de gracia y el cliente no llega ni aviso:
El peluquero/admin puede marcar no_show.
El sistema incrementa no_show_count.
12.4 Lista negra
Si no_show_count llega a 3:
is_blacklisted = true.
La lista negra no bloquea automaticamente.
El sistema mostrara alerta visual al admin/peluquero.
El administrador puede decidir:
Permitir reservas.
Requerir confirmacion manual.
Bloquear manualmente si hay reincidencia.
12.5 Bloqueo manual
is_blocked = true.
El cliente bloqueado no puede crear nuevas reservas, o solo con aprobacion manual.
El bloqueo debe quedar auditado.
ESTADO DEL NEGOCIO
13.1 Estados posibles
open
closed
emergency_closed
Opcionalmente:
appointment_only
full
13.2 Datos
status
message
emergency_reason
expected_return_at
updated_by
updated_at
13.3 Reglas
El administrador puede abrir/cerrar manualmente.
El cierre por emergencia muestra mensaje publico.
El cierre por emergencia no borra citas automaticamente.
Las citas afectadas pueden quedar needs_reschedule.
El administrador debera reprogramar y notificar.
CIERRE POR EMERGENCIA
Flujo:
Administrador marca cierre por emergencia.
Sistema actualiza estado del negocio.
La app muestra:
Cerrado por emergencia.
Mensaje informativo.
Sistema identifica citas afectadas.
Citas afectadas quedan needs_reschedule.
Administrador revisa citas.
Puede:
Reprogramar.
Reasignar peluquero.
Cancelar.
Sistema notifica internamente al cliente.
Administrador puede usar WhatsApp manual como apoyo.
Mensaje sugerido:
"Hola. Lamentamos el inconveniente. La peluqueria cerro por emergencia. Tu cita sera reprogramada. Te contactaremos pronto."
REASIGNACION DE CITAS
15.1 Cuando aplicar
Peluquero desactivado.
Peluquero ausente.
Emergencia.
Cierre temporal.
Necesidad operativa.
15.2 Flujo
Sistema lista citas afectadas.
Administrador selecciona nueva fecha y/o peluquero.
La cita queda pending_client_confirmation.
Cliente recibe notificacion interna.
Cliente puede:
Confirmar.
Solicitar otro horario.
Si confirma:
status = confirmed.
Si no confirma:
Administrador gestiona manualmente.
15.3 Registro
Guardar:
reassigned_from_barber_id
emergency_reason
client_confirmation_status
updated_at
MODULO DE GALERIA / CATALOGO DE TRABAJOS
16.1 Gestion
Solo el administrador publica fotos.
No se publican fotos automaticamente.
Se publican principalmente disenos innovadores o destacados.
16.2 Datos de publicacion
id
title
description
service_id nullable
barber_id nullable
status
client_consent
consent_date
authorized_by
is_minor_consent
featured
created_at
16.3 Imagenes
Una publicacion puede tener una o varias imagenes.
Las imagenes se suben comprimidas.
Se generan miniaturas.
Solo se guarda path en base de datos.
16.4 Estados
draft
published
hidden
16.5 Reglas
Toda publicacion debe registrar consentimiento.
Si es menor de edad, debe registrar consentimiento del representante.
Si un cliente retira consentimiento, se oculta o elimina la publicacion.
MODULO DE PRODUCTOS
17.1 Datos del producto
id
name
description
price
stock
status
image_path
thumbnail_path
category
created_at
updated_at
17.2 Estados
active
hidden
archived
out_of_stock
17.3 Reglas
El administrador publica productos.
El administrador define stock.
No se maneja contabilidad.
No se maneja caja.
Se puede marcar vendido/entregado a nivel operativo.
APARTADO DE PRODUCTOS
18.1 Datos
id
client_id
product_id
status
quantity
expires_at
created_at
updated_at
18.2 Estados
requested
reserved
picked_up
expired
canceled
18.3 Regla de 24 horas
Al reservar/apartar:
expires_at = created_at + 24 horas.
Si el cliente recoge:
status = picked_up.
Si no recoge:
status = expired.
Al expirar:
El stock vuelve a estar disponible.
Se notifica internamente si aplica.
18.4 Stock
El sistema debe evitar apartados si no hay stock.
Se recomienda manejar stock disponible y stock apartado.
Operaciones de apartado deben usar transaccion.
MODULO DE NOTIFICACIONES INTERNAS
19.1 Principio
Las notificaciones seran internas.
No se usaran servicios externos de push, email o SMS como requisito.
19.2 Datos
id
user_id
type
title
body
data jsonb
read_at
created_at
19.3 Tipos
appointment_created
appointment_confirmed
appointment_canceled
appointment_rescheduled
appointment_reminder
appointment_no_show
home_service_update
product_reserved
product_ready
product_expired
chat_message
promotion_new
system_update
admin_message
account_update
19.4 Preferencias
Tabla notification_preferences:
user_id
appointment_notifications
promotion_notifications
chat_notifications
system_notifications
muted_all
updated_at
19.5 Reglas
El cliente puede silenciar notificaciones secundarias.
Las notificaciones criticas deben mostrarse como banner dentro de la app.
Si el usuario silencia todo, mostrar advertencia:
"Podrias no recibir avisos importantes sobre tus citas."
El centro de notificaciones debe mostrar contador de no leidas.
MODULO DE CHAT
20.1 Alcance
Chat interno.
Solo texto.
Sin imagenes en esta version.
20.2 Conversaciones
conversation_id
client_id
barber_id nullable
admin_id nullable
appointment_id nullable
status
created_at
20.3 Mensajes
id
conversation_id
sender_id
body
read_at
created_at
20.4 Anti-spam
Limites sugeridos:
Maximo 20 mensajes por minuto por usuario.
Maximo 200 mensajes por dia por usuario.
Si supera limites:
Mostrar advertencia.
Bloquear temporalmente envio.
Registrar incidente.
El administrador puede silenciar o bloquear chat de usuario abusivo.
20.5 Uso operativo
Confirmar asistencia.
Avisar retraso.
Coordinar domicilio.
Resolver dudas basicas.
MODULO DE MENORES DE EDAD
21.1 Reserva para menor
Campos recomendados:
is_minor_appointment
minor_name
guardian_name
guardian_phone
guardian_consent
21.2 Reglas
La reserva la realiza el padre/tutor.
Se deben guardar datos del tutor.
Se debe registrar consentimiento del tutor.
Para publicar fotos de menores:
Autorizacion explicita del representante.
Si no hay autorizacion:
No publicar.
MODULO DE ANUNCIOS Y ACTUALIZACIONES
22.1 Tabla announcements
id
title
body
type
role_target
active
created_by
created_at
22.2 Tipos
update
maintenance
promotion
info
critical
22.3 Reglas
Las actualizaciones del sistema se notifican dentro del sistema.
Los anuncios criticos pueden mostrarse como banner visible.
Los anuncios normales pueden mostrarse en centro de notificaciones.
DASHBOARD PUBLICO / PAGINA INFORMATIVA
La pantalla principal del sistema debe funcionar como pagina informativa moderna.
23.1 Secciones recomendadas
Hero principal.
Estado del negocio en vivo.
Servicios destacados.
Galeria de estilos.
Peluqueros/equipo.
Productos destacados.
Promociones o anuncios.
Horarios.
Ubicacion.
Contacto manual por WhatsApp.
Boton de reserva.
Boton de instalacion de app.
23.2 Objetivo
Atraer clientes.
Informar servicios y precios.
Mostrar trabajos.
Facilitar reserva.
Mostrar estado abierto/cerrado.
23.3 SEO
Usar Next.js si se desea mejor indexacion.
Configurar titulo, descripcion e imagen.
Configurar Open Graph.
Usar URLs amigables.
Considerar structured data tipo LocalBusiness/BarberShop.
UI/UX Y DISENO
24.1 Estilo general
Moderno.
Colorido.
Tematica de peluqueria/barberia.
Iconos representativos.
Animaciones suaves tipo app/videojuego moderno.
Movil primero.
24.2 Paleta sugerida
Fondo oscuro suave.
Primario violeta o magenta.
Acento cyan.
Detalles dorados.
Colores claros para estados:
Verde: abierto/exito.
Amarillo: advertencia.
Rojo: error/cerrado.
24.3 Iconos
Tijeras para corte.
Navaja para barberia.
Brocha para tinte.
Brillos para diseno.
Corona para cambio de look.
Moto/casa para domicilio.
Bolsa para productos.
Campana para notificaciones.
Calendario para agenda.
24.4 Animaciones
Entrada suave de tarjetas.
Transiciones entre pantallas.
Botones con respuesta tactil.
Estado abierto/cerrado con pulso.
Skeletons de carga.
Contadores animados.
Confirmacion de cita con animacion de exito.
24.5 Reglas de rendimiento
Animar principalmente transform y opacity.
Respetar prefers-reduced-motion.
Permitir reducir animaciones.
Lazy loading de imagenes y secciones.
No cargar animaciones pesadas en el primer pantallazo.
IMAGENES Y ALMACENAMIENTO
25.1 Principios
No guardar imagenes en base64 dentro de PostgreSQL.
Guardar imagenes en Supabase Storage.
Guardar solo path/URL en base de datos.
No cifrar imagenes como texto.
Comprimir siempre antes de subir.
25.2 Buckets recomendados
Publicos:
gallery
products
avatars
services
Privados:
references
chat_attachments si en futuro se permiten
25.3 Optimizacion
Valores sugeridos:
Imagen principal producto/servicio: 1000-1400 px, max 250-400 KB.
Galeria: 1400-1600 px, max 300-500 KB.
Miniatura: 300-500 px, max 20-60 KB.
Referencia privada: 1000 px, max 200-400 KB.
Formato recomendado: WebP.
25.4 Ciclo de vida
Referencias privadas: expiran o se eliminan despues de 30/60 dias.
Imagenes de productos vendidos/archivados: pueden eliminarse si ya no se necesitan.
Archivos temporales: eliminar despues de 24/48 horas.
Notificaciones antiguas: eliminar despues de 90 dias.
Mensajes de chat: eliminar despues de 90/180 dias si se desea.
25.5 Limpieza
El administrador puede borrar imagenes manualmente.
Se debe evitar archivos huerfanos.
Se recomienda tabla uploaded_files o limpieza programada futura.
SEGURIDAD
26.1 Supabase
Activar Row Level Security en todas las tablas.
Activar politicas de acceso en Storage.
No exponer service_role key en frontend.
Usar anon key en frontend.
Usar funciones security definer para acciones privilegiadas.
26.2 Validaciones
Validar entrada en frontend y backend.
Validar roles en backend.
Validar precios positivos.
Validar duraciones validas.
Validar telefonos.
Validar archivos subidos:
Tipo imagen.
Tamano maximo.
Extensiones permitidas.
26.3 Auditoria
Tabla audit_logs:
id
actor_id
action
entity
entity_id
data jsonb
created_at
Acciones a auditar:
Cambio de roles.
Conversion a peluquero.
Baja de cliente.
Bloqueo de cliente.
Cierre por emergencia.
Reasignacion de citas.
Cambios en servicios.
Cambios en productos.
Cambios en galeria.
Cambios en configuracion.
26.4 Proteccion de administradores
Un admin no debe poder desactivar su propia cuenta.
No permitir dejar cero administradores activos.
Registrar quien desactivo a quien.
El superadmin puede restaurar acceso si hay error.
BASE DE DATOS RECOMENDADA
Tablas principales:
profiles
barber_profiles
barber_services
services
categories
schedules
schedule_exceptions
appointments
pending_barbers
gallery_posts
gallery_images
products
product_reservations
notifications
notification_preferences
announcements
conversations
messages
audit_logs
business_settings
feature_flags
ESQUEMA BASICO DE TABLAS
profiles:
id uuid primary key references auth.users
email text
full_name text
phone text
phone_normalized text
phone_confirmed_at timestamptz
birthday date
address text
role text
status text
no_show_count integer default 0
late_cancel_count integer default 0
is_blacklisted boolean default false
blacklist_reason text
is_blocked boolean default false
blocked_reason text
blocked_by uuid
blocked_at timestamptz
marketing_consent boolean default false
photo_consent boolean default false
created_at timestamptz
updated_at timestamptz
barber_profiles:
id uuid primary key
user_id uuid unique references profiles
display_name text
bio text
photo_url text
specialties text
commission_percent numeric
active boolean
created_at timestamptz
updated_at timestamptz
services:
id uuid primary key
name text
description text
category_id uuid nullable
price numeric
duration_minutes integer
grace_minutes integer
image_path text
thumbnail_path text
active boolean
home_service_allowed boolean
requires_reference boolean
gender_tag text
created_at timestamptz
updated_at timestamptz
schedules:
id uuid primary key
barber_id uuid references barber_profiles
weekday integer
start_time time
end_time time
active boolean
schedule_exceptions:
id uuid primary key
barber_id uuid nullable
type text
reason text
start_at timestamptz
end_at timestamptz
created_by uuid
created_at timestamptz
appointments:
id uuid primary key
client_id uuid references profiles
barber_id uuid references barber_profiles
service_id uuid references services
date date
start_time timestamptz
end_time timestamptz
duration_snapshot integer
price_snapshot numeric
service_name_snapshot text
appointment_type text
status text
address text
location_reference text
reference_image_path text
notes text
is_delayed boolean default false
delay_note text
no_show boolean default false
reassigned_from_barber_id uuid nullable
emergency_reason text
client_confirmation_status text
created_at timestamptz
updated_at timestamptz
pending_barbers:
id uuid primary key
email text
full_name text
phone text
specialties text
bio text
photo_url text
commission_percent numeric
status text
invited_by uuid
accepted_at timestamptz
expires_at timestamptz
created_at timestamptz
gallery_posts:
id uuid primary key
title text
description text
service_id uuid nullable
barber_id uuid nullable
status text
client_consent boolean
consent_date timestamptz
authorized_by uuid
is_minor_consent boolean
featured boolean
created_at timestamptz
updated_at timestamptz
gallery_images:
id uuid primary key
gallery_post_id uuid references gallery_posts
image_path text
thumbnail_path text
sort_order integer
created_at timestamptz
products:
id uuid primary key
name text
description text
price numeric
stock integer
status text
image_path text
thumbnail_path text
category text
created_at timestamptz
updated_at timestamptz
product_reservations:
id uuid primary key
client_id uuid references profiles
product_id uuid references products
quantity integer
status text
expires_at timestamptz
created_at timestamptz
updated_at timestamptz
notifications:
id uuid primary key
user_id uuid references profiles
type text
title text
body text
data jsonb
read_at timestamptz
created_at timestamptz
notification_preferences:
user_id uuid primary key references profiles
appointment_notifications boolean
promotion_notifications boolean
chat_notifications boolean
system_notifications boolean
muted_all boolean
updated_at timestamptz
announcements:
id uuid primary key
title text
body text
type text
role_target text
active boolean
created_by uuid
created_at timestamptz
conversations:
id uuid primary key
client_id uuid references profiles
barber_id uuid nullable references barber_profiles
admin_id uuid nullable references profiles
appointment_id uuid nullable references appointments
status text
created_at timestamptz
messages:
id uuid primary key
conversation_id uuid references conversations
sender_id uuid references profiles
body text
read_at timestamptz
created_at timestamptz
audit_logs:
id uuid primary key
actor_id uuid references profiles
action text
entity text
entity_id uuid
data jsonb
created_at timestamptz
business_settings:
key text primary key
value jsonb
updated_at timestamptz
feature_flags:
key text primary key
enabled boolean
description text
updated_at timestamptz
LOGICA DE NEGOCIO CRITICA
29.1 Creacion automatica de perfil
Cuando un usuario inicia sesion con Google:
Supabase crea registro en auth.users.
Trigger crea perfil en profiles.
Rol por defecto: client.
Estado: active.
29.2 Deteccion de peluquero pre-registrado
Cuando un usuario inicia sesion:
Buscar en pending_barbers por email.
Si existe y esta pendiente:
Crear/actualizar barber_profile.
Actualizar estado de pending_barbers.
Si el usuario era client, cambiar role a barber.
Si era admin, mantener admin.
Si no existe:
Mantener cliente.
29.3 Validacion de telefono para reservar
Antes de crear reserva:
Verificar que profiles.phone existe.
Si no existe, exigir registro de telefono.
Si existe, pedir confirmacion.
Actualizar phone_confirmed_at.
29.4 Limite de cuentas por telefono
Antes de registrar cuenta:
Normalizar telefono.
Contar cuentas activas con ese phone_normalized.
Si count >= 3:
Bloquear registro.
Mostrar mensaje de contacto.
29.5 Anti-spam de reservas
Antes de crear reserva:
Validar que el cliente no este bloqueado.
Validar maximo de citas futuras activas.
Validar maximo de reservas por dia.
Validar disponibilidad real.
Aplicar cooldown entre solicitudes.
Limites sugeridos:
Maximo 2 citas futuras activas por cliente.
Maximo 3 reservas creadas por dia.
Maximo 1 solicitud de domicilio pendiente.
Cooldown de 30 segundos entre solicitudes.
29.6 Cancelacion con 2 horas
Antes de cancelar:
Calcular diferencia entre now() y start_time.
Si diferencia >= 2 horas:
Permitir cancelacion.
Liberar horario.
Notificar.
Si diferencia < 2 horas:
Rechazar cancelacion automatica.
Mostrar contacto/WhatsApp.
29.7 No show y lista negra
Al marcar no_show:
appointments.no_show = true.
profiles.no_show_count += 1.
Si no_show_count >= 3:
profiles.is_blacklisted = true.
Registrar auditoria.
29.8 Apartado de productos
Al reservar producto:
Validar stock.
Crear product_reservations.
expires_at = now() + 24 hours.
Actualizar stock apartado/disponible.
Al expirar:
status = expired.
Restaurar stock disponible.
Notificar si aplica.
FLUJOS PRINCIPALES
30.1 Cliente se registra
Entra al sistema.
Presiona iniciar sesion con Google.
Se crea perfil cliente.
Puede navegar catalogo.
Para reservar, confirma telefono.
30.2 Admin registra peluquero
Admin entra a panel.
Va a peluqueros.
Presiona registrar peluquero.
Completa datos y correo.
Sistema guarda pending_barber.
Peluquero inicia sesion con Google usando ese correo.
Sistema activa perfil de peluquero.
30.3 Admin convierte cliente en peluquero
Admin busca cliente.
Abre detalle.
Presiona convertir en peluquero.
Completa datos.
Sistema crea barber_profile.
Usuario obtiene acceso a vista peluquero.
30.4 Cliente reserva
Elige servicio.
Elige peluquero/horario.
Confirma telefono.
Puede subir referencia.
Confirma.
Sistema crea cita.
Se notifica internamente.
30.5 Cliente cancela
Abre sus citas.
Presiona cancelar.
Si faltan >= 2 horas:
Cancela.
Libera horario.
Si faltan < 2 horas:
Muestra mensaje de contacto.
30.6 Peluquero atiende cita
Ve agenda.
Abre cita.
Ve referencia.
Inicia cita.
Completa cita.
Opcionalmente registra pago simple si se habilita.
30.7 Cliente no asiste
Pasa tiempo de gracia.
Peluquero marca no show.
Sistema incrementa contador.
Si llega a 3, marca lista negra.
30.8 Admin reasigna cita
Admin selecciona cita afectada.
Elige nuevo peluquero/fecha.
Cita queda pending_client_confirmation.
Cliente recibe notificacion.
Cliente confirma o pide cambio.
30.9 Admin cierra por emergencia
Admin marca cierre por emergencia.
App muestra cerrado.
Citas afectadas quedan needs_reschedule.
Admin reprograma.
Se notifica clientes.
30.10 Cliente aparta producto
Cliente ve producto.
Presiona apartar.
Sistema reserva por 24 horas.
Cliente recoge y paga presencialmente.
Admin marca entregado.
Si no recoge, expira.
ESTRUCTURA FRONTEND RECOMENDADA
src/
app/
features/
auth/
home/
booking/
appointments/
barbers/
services/
gallery/
products/
notifications/
chat/
admin/
superadmin/
announcements/
settings/
shared/
ui/
hooks/
lib/
utils/
theme/
animations/
types/
constants/
config/
styles/
MODULARIZACION FRONTEND
Cada feature debe contener:
components/
hooks/
services/
types/
utils/
Principios:
Componentes UI reutilizables en shared/ui.
Logica de acceso a datos en services o hooks.
No poner consultas complejas dentro de componentes visuales.
Usar tipos TypeScript.
Validar formularios con Zod o similar.
Usar feature flags para activar/desactivar modulos.
STACK TECNICO RECOMENDADO
Frontend:
React.
Next.js recomendado.
TypeScript.
Tailwind CSS.
Framer Motion para animaciones.
Lucide Icons o similar.
TanStack Query para cache de datos.
React Hook Form.
Zod.
Zustand o Context para estado ligero.
date-fns o dayjs para fechas.
browser-image-compression para comprimir imagenes.
Backend:
Supabase Auth.
Supabase Postgres.
Supabase Storage.
Supabase Realtime.
Row Level Security.
Funciones PostgreSQL para acciones criticas.
Triggers para creacion de perfil.
Deployment:
Vercel.
Repositorio Git.
Entornos:
Desarrollo.
Produccion.
VARIABLES DE ENTORNO
Frontend:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
No exponer:
SUPABASE_SERVICE_ROLE_KEY
Claves privadas
Tokens de setup
Backend/Edge Functions si requiere:
SUPABASE_SERVICE_ROLE_KEY solo en entorno seguro.
REQUISITOS NO FUNCIONALES
35.1 Rendimiento
Mobile first.
Carga rapida en celulares.
Imagenes optimizadas.
Listas paginadas.
Lazy loading.
Animaciones fluidas.
Evitar cargas pesadas al inicio.
35.2 Seguridad
RLS activo.
Validacion en backend.
Auditoria.
Proteccion de rutas.
No exponer claves.
Validacion de archivos.
Prevencion basica de spam.
35.3 Privacidad
Consentimiento para fotos.
Consentimiento para promociones.
Datos minimos.
Referencias privadas.
Posibilidad de dar de baja cuentas.
35.4 Mantenibilidad
Codigo modular.
Tipos claros.
Migraciones versionadas.
Componentes reutilizables.
Documentacion minima.
35.5 Accesibilidad
Buen contraste.
Botones claros.
Textos legibles.
Respetar reduced motion.
Navegacion simple.
35.6 Disponibilidad
El sistema debe estar disponible la mayor parte del tiempo.
Mostrar mensaje si no hay conexion.
Backup periodico de base de datos.
35.7 Costos
No usar APIs de pago si no es necesario.
Optimizar almacenamiento.
Monitorear limites de Supabase y Vercel.
CONFIGURACION DEL NEGOCIO
business_settings debe permitir configurar:
Nombre del negocio.
Logo.
Portada.
Direccion.
Telefono.
WhatsApp manual.
Horario informativo.
Mensaje publico.
Estado del negocio.
Buffer entre citas.
Anticipacion minima de reserva.
Anticipacion minima domicilio.
Tiempo de gracia por defecto.
Maximo de cuentas por telefono.
Limite de reservas por cliente.
Duracion de apartado de productos.
Nivel de animaciones.
Feature flags.
FEATURE FLAGS
Flags sugeridos:
enable_home_service
enable_products
enable_gallery
enable_chat
enable_walk_in
enable_announcements
enable_blacklist_alerts
enable_client_mute
enable_superadmin_panel
enable_animations
enable_public_dashboard
Esto permitira activar/desactivar modulos sin reprogramar todo.
PWA Y ACTUALIZACIONES
38.1 PWA
El sistema debe poder instalarse como app web.
Debe mostrar boton:
"Instalar app".
Debe tener icono y splash basico.
38.2 Actualizaciones
Cuando haya nueva version, notificar dentro del sistema.
Usar announcements.
Para actualizaciones criticas:
Banner visible.
Opcion de recargar.
Manejar service worker para evitar versiones viejas.
WHATSAPP MANUAL
No se usara WhatsApp API pagada.
Se pueden incluir enlaces manuales:
https://wa.me/NUMERO?text=MENSAJE
Usos:
Contacto del cliente.
Apoyo en cancelaciones tardias.
Apoyo en emergencias.
Confirmacion de reprogramaciones.
Consultas generales.
El envio sera manual por parte del administrador o del usuario.
CONSIDERACIONES LEGALES Y DE SERVICIO
Debido a que el desarrollador administra infraestructura y vende el servicio, se recomienda definir:
40.1 Terminos basicos
El sistema es un servicio.
El desarrollador administra infraestructura.
El negocio administra contenido y atencion.
El desarrollador no se responsabiliza por perdidas operativas del negocio.
Se define alcance de soporte.
40.2 Privacidad
Datos recopilados.
Uso de datos.
Quien puede ver datos.
Proceso para baja de cuentas.
Proceso para eliminar datos cuando aplique.
40.3 Fotos
Solo se publican fotos con autorizacion.
Menores requieren autorizacion del representante.
Se puede retirar autorizacion.
40.4 Reservas
Politica de cancelacion de 2 horas.
Politica de inasistencias.
Lista negra.
Bloqueo manual.
Reprogramaciones por emergencia.
40.5 Salida del servicio
Si el negocio deja de usar el sistema:
Se puede exportar informacion importante.
Se puede entregar backup.
Se define tiempo de retencion antes de eliminar.
BACKUPS Y CONTINGENCIA
41.1 Backups
Recomendacion minima:
Backup semanal de base de datos.
Backup de imagenes importantes.
Backup de logo/portada.
Guardar copia en almacenamiento del negocio o desarrollador.
41.2 Contingencia operativa
Si el sistema falla:
El negocio puede usar agenda manual temporal.
Debe tener lista de servicios/precios visible.
Debe tener contacto alternativo.
PLAN DE PRUEBAS
Antes de lanzar, probar:
42.1 Usuarios
Registro con Google.
Creacion automatica de perfil cliente.
Admin convierte cliente en peluquero.
Admin registra peluquero nuevo.
Limite de 3 cuentas por telefono.
Baja de cliente libera telefono.
Admin no puede desactivarse a si mismo.
No quedar sin administradores activos.
42.2 Modos
Administrador sin peluquero solo ve admin/cliente.
Administrador con peluquero ve selector.
Modo por defecto peluquero si tiene perfil activo.
Cambio de modo rapido.
Vista previa cliente muestra contenido publicado.
42.3 Reservas
Crear reserva.
Telefono obligatorio.
Confirmacion de telefono existente.
Disponibilidad correcta.
Buffer de 5 minutos.
No solapamiento de citas.
Precio snapshot.
Duracion snapshot.
Cancelacion con 2 horas.
Cancelacion tardia bloqueada.
No show incrementa contador.
Lista negra a los 3 no-show.
Bloqueo manual.
42.4 Peluqueros
Horarios.
Servicios asignados.
Ausencias.
Feriados.
Vacaciones.
Desactivacion.
Reasignacion de citas.
Confirmacion de cliente.
42.5 Negocio
Abrir/cerrar negocio.
Cierre por emergencia.
Mensaje visible.
Citas afectadas.
Reprogramacion.
42.6 Imagenes
Compresion antes de subir.
Miniaturas.
Galeria publicada.
Consentimiento registrado.
Imagen privada con acceso restringido.
Eliminacion de imagen sin romper registro.
42.7 Productos
Publicar producto.
Stock.
Apartar producto.
Expiracion 24 horas.
Stock restaurado.
Recogida de producto.
42.8 Notificaciones
Notificacion creada.
Contador no leidas.
Preferencias de silencio.
Banner critico.
Anuncio de actualizacion.
42.9 Chat
Enviar mensaje.
Solo texto.
Limite anti-spam.
Lectura de mensajes.
Conversacion relacionada a cita.
CHECKLIST DE LANZAMIENTO
Infraestructura:
Proyecto Supabase configurado.
Proyecto Vercel configurado.
Repositorio Git configurado.
Variables de entorno configuradas.
Dominio configurado si aplica.
HTTPS activo.
Backup inicial realizado.
Seguridad:
RLS activo en tablas.
Politicas de Storage.
No service_role en frontend.
Auditoria activa.
Validaciones de entrada.
Limites anti-spam.
Usuarios:
Trigger de nuevo usuario.
Perfiles con rol cliente.
Dos administradores activos.
Superadmin tecnico activo.
Peluqueros registrados.
Owner/admin con perfil peluquero si aplica.
Negocio:
Servicios creados.
Precios definidos.
Duraciones definidas.
Peluqueros asignados a servicios.
Horarios configurados.
Buffer configurado.
Tiempo de gracia configurado.
Estado del negocio configurado.
Datos del negocio configurados.
Contenido:
Galeria inicial publicada.
Productos iniciales publicados.
Anuncio de bienvenida si aplica.
Logo/portada cargados.
Imagenes comprimidas.
PWA:
Instalacion funcional.
Icono correcto.
Splash correcto.
Manifest correcto.
Actualizacion de version controlada.
Pruebas:
Flujo de reserva probado.
Flujo de cancelacion probado.
Flujo de reasignacion probado.
Flujo de emergencia probado.
Flujo de productos probado.
Chat probado.
Notificaciones probadas.
Roles probados.
AMPLIACION APROBADA: ESTADISTICAS DEL NEGOCIO
Estado: IMPLEMENTADO Y DESPLEGADO el 9 de agosto de 2026.
El panel administrador incluye una seccion protegida de inteligencia de negocio.
La primera etapa utiliza datos internos confirmables:
Servicios completados por mes.
Comparacion con el mes anterior.
Valor registrado de servicios completados.
Ticket promedio registrado.
Nuevos usuarios y total de cuentas registradas.
Clientes recurrentes con dos o mas servicios completados.
Cancelaciones e inasistencias.
Servicios mas demandados.
Productos marcados como recogidos.
Peluqueros con mayor cantidad de trabajos completados.
Meses, fechas, dias de semana y horas con mayor demanda.
Las cifras de servicios se presentan como valor registrado y no como dinero cobrado mientras no exista confirmacion de caja.
Solo administradores y superadmin pueden consultar estas estadisticas.

CAMBIO DE ALCANCE APROBADO: OPERACION, FIDELIZACION E INCENTIVOS
Fecha de aprobacion funcional: 9 de agosto de 2026.
Esta ampliacion deja de considerar caja operativa, fidelizacion y comisiones como ideas fuera de alcance.
Se desarrollaran por etapas sobre la aplicacion actual.
No implica pagos online ni contabilidad fiscal completa.

43. CAJA OPERATIVA / PUNTO DE VENTA
43.1 Objetivo
Registrar todas las atenciones y ventas del negocio, incluyendo clientes que llegan sin reserva web.
Una reserva no equivale a una venta ni a un pago.
Los puntos y comisiones solo se generan cuando el servicio o producto fue completado y el pago fue confirmado.

43.2 Venta unificada
Cada venta podra contener:
Servicios.
Productos.
Cliente registrado o invitado.
Peluquero que realizo el servicio.
Peluquero que recomendo un producto, si aplica.
Precios historicos.
Descuentos y promociones.
Importe pagado.
Forma de pago.
Puntos generados o canjeados.
Comisiones e incentivos.
Comprobante interno.

43.3 Estados minimos
draft: atencion iniciada.
pending_payment: servicio terminado y pendiente de caja.
paid: pago confirmado.
canceled: operacion anulada antes de cobrar.
refunded: devolucion o reversion autorizada.
Las ventas pagadas no se borran. Se corrigen mediante anulaciones o movimientos de reversion auditados.

43.4 Atenciones sin reserva
El peluquero o cajero podra crear una atencion walk-in.
Se seleccionara peluquero, servicio y cliente registrado o invitado.
La atencion sin reserva usara el mismo catalogo y precio vigente que una reserva web.
El precio, duracion, porcentaje de comision y nombre del servicio se guardaran como snapshot.

43.5 Pagos y cierre
La primera etapa registrara pagos presenciales informativos: efectivo, QR, transferencia u otro metodo autorizado.
No procesara pagos online.
La caja permitira apertura, monto inicial, ingresos, egresos justificados, cierre, monto esperado, monto contado y diferencia.
Cada turno tendra un responsable.

44. CAPACIDAD DE CAJERO
Se agregara una capacidad o rol operativo de cajero, separada del administrador.
Un administrador podra tambien trabajar como cajero.
El cajero podra registrar walk-ins, buscar clientes, confirmar pagos, aplicar promociones autorizadas, registrar productos y emitir comprobantes.
El cajero no podra crear administradores, cambiar reglas de comision, modificar campañas, eliminar ventas ni acceder a configuracion tecnica.
El peluquero podra registrar o confirmar el trabajo realizado, pero no confirmar el pago ni modificar precios o descuentos salvo permiso especial.

45. REGLA ECONOMICA DE SERVICIOS Y PELUQUEROS
45.1 Precio y reparto aprobado
El corte de cabello de varon tiene como precio de referencia actual Bs 25, pero el precio continuara siendo configurable por servicio.
El peluquero recibe 50% del precio normal completo del servicio.
La promocion o descuento se descuenta exclusivamente de la participacion del negocio.
La comision del peluquero no disminuye por una promocion creada por administracion.

45.2 Formula
commission_base = precio normal registrado del servicio.
barber_commission = commission_base * 0.50.
customer_total = precio normal - descuento.
business_share = customer_total - barber_commission.

Ejemplo sin descuento:
Precio normal Bs 25.
Cliente paga Bs 25.
Peluquero recibe Bs 12,50.
Negocio recibe Bs 12,50 antes de otros gastos.

Ejemplo con 20% de descuento:
Precio normal Bs 25.
Cliente paga Bs 20.
Peluquero mantiene Bs 12,50.
Negocio recibe Bs 7,50 antes de otros gastos.

Ejemplo con 50% de descuento:
Precio normal Bs 25.
Cliente paga Bs 12,50.
Peluquero mantiene Bs 12,50.
Negocio recibe Bs 0.

Los descuentos superiores a la participacion normal del negocio deberan bloquearse o requerir autorizacion extraordinaria porque generan una perdida directa.
En interfaz y reportes se usara el termino participacion del negocio, no ganancia del administrador.

45.3 Historial y liquidaciones
Cada servicio pagado creara un movimiento de comision inmutable.
Estados sugeridos: pending, approved, paid y reversed.
El peluquero vera servicios completados, comision pendiente y liquidaciones anteriores.
El administrador podra cerrar periodos, aprobar liquidaciones y registrar el pago al peluquero.

46. INCENTIVOS POR PRODUCTOS
El peluquero podra quedar asociado como recomendador o vendedor de un producto.
El incentivo de producto sera independiente de la comision de servicios.
El porcentaje o monto podra configurarse por producto, categoria o campaña.
El incentivo solo se generara cuando el producto sea entregado y el pago sea confirmado.
Una reserva o apartado no genera incentivo.
El porcentaje inicial de incentivo por productos queda PENDIENTE DE DEFINICION por el negocio.

47. INSUMOS Y REEMBOLSOS DE PELUQUEROS
Los insumos comprados por peluqueros no se mezclaran silenciosamente con sus comisiones.
Se registraran como movimientos independientes con peluquero, concepto, importe, fecha, comprobante opcional y motivo.
Estados sugeridos: pending, approved, rejected y reimbursed.
El administrador aprobara o rechazara cada solicitud.
El resumen del peluquero mostrara por separado comisiones, incentivos, reembolsos y total pendiente.

48. PROGRAMA DE PUNTOS PARA CLIENTES
48.1 Principios
Los puntos no son dinero y no se guardaran solamente como un saldo editable.
Cada aumento, canje, expiracion, ajuste o reversion tendra un movimiento historico.
La suma de movimientos determinara el saldo.
Cada origen tendra una clave unica para impedir entregar dos veces los mismos puntos.

48.2 Formas de ganar puntos
Servicio completado y pagado.
Producto entregado y pagado, si la campaña lo permite.
Primera atencion vinculada despues del registro.
Referido valido.
Racha de asistencia.
Campaña temporal.
Ajuste manual auditado por administrador.

48.3 Canjes
Los puntos podran canjearse por descuentos, productos seleccionados o servicios promocionales.
Cada recompensa definira costo en puntos, vigencia, limite de usos, stock o cupo, servicios/productos permitidos y descuento maximo.
Los canjes que afecten servicios respetaran siempre la comision completa del peluquero.
El costo del beneficio saldra de la participacion del negocio o de un presupuesto promocional definido.

48.4 Valores pendientes de aprobacion
Puntos por servicio completado.
Puntos por monto de compra.
Puntos de bienvenida.
Vencimiento de puntos.
Catalogo inicial de recompensas.
Valor y limite de cada descuento.
No se codificaran cantidades definitivas hasta que administracion apruebe estas reglas.

49. REFERIDOS
Cada cliente registrado tendra codigo y QR personal de referido.
El referido podra indicarse en una reserva, en caja o durante el registro de una atencion invitada.
No se otorgaran puntos por crear una cuenta sin consumo.
La recompensa se liberara cuando el nuevo cliente complete y pague su primera atencion y vincule su cuenta Google.
Se impediran autorreferidos, reutilizacion del mismo cliente y asignaciones duplicadas.
El codigo solo podra asociarse una vez y las correcciones requeriran auditoria.
Los puntos para quien refiere y para el nuevo cliente quedan PENDIENTES DE DEFINICION.

50. RACHAS DE ASISTENCIA
La racha se basara en visitas completadas, no en reservas creadas.
Una cancelacion realizada dentro de las reglas no rompera automaticamente la racha.
Una inasistencia si podra romperla.
El administrador configurara numero de visitas, periodo maximo entre visitas, recompensa y vigencia de campaña.
El numero de visitas, dias permitidos y puntos de bonificacion quedan PENDIENTES DE DEFINICION.

51. CLIENTE INVITADO Y VINCULACION POSTERIOR
Un cliente sin cuenta podra ser atendido como invitado.
No se crearan cuentas Google en nombre del cliente.
La venta emitira un codigo o QR de vinculacion de un solo uso y con vencimiento.
Al iniciar sesion con Google, el cliente podra reclamar su atencion y recibir historial y puntos correspondientes.
No se vinculara una venta solamente por telefono mientras no exista verificacion OTP.
La vinculacion debe prevenir que otra persona reclame una atencion ajena.

52. COMPROBANTE INTERNO
Cada pago confirmado generara un comprobante interno correlativo.
Incluira negocio, fecha, cliente o invitado, peluquero, servicios, productos, precios, descuentos, total, forma de pago, puntos y QR.
Podra imprimirse en formato termico y descargarse como PDF.
Mientras no exista integracion fiscal autorizada mostrara claramente:
COMPROBANTE INTERNO - NO VALIDO COMO CREDITO FISCAL.
No se denominara factura fiscal.
La integracion con SIAT sera un proyecto separado que requerira definicion tributaria, credenciales y validacion del SIN.

53. ANALITICA DE MARKETING - SIGUIENTE ETAPA
El tablero interno ya mide comportamiento registrado dentro del sistema.
Para medir visitantes y campañas se agregara posteriormente:
Visitas unicas y sesiones.
Origen de trafico y parametros UTM.
Clics en reservar, WhatsApp, Instagram, Facebook y mapa.
Conversion de visita a inicio de reserva.
Conversion de inicio a reserva completada.
Conversion de invitado a cuenta Google.
Uso y retorno de campañas y referidos.
La analitica web debera respetar consentimiento, privacidad y minimizacion de datos.

54. ESTRUCTURA DE DATOS PROPUESTA PARA LA AMPLIACION
sales y sale_items: ventas, servicios y productos.
payments: confirmaciones y formas de pago.
cash_shifts y cash_movements: apertura, movimientos y cierre de caja.
receipts: numeracion y representacion del comprobante.
guest_customers y claim_tokens: atencion invitada y vinculacion segura.
barber_earnings: comisiones e incentivos historicos.
payout_periods y payout_items: liquidaciones al equipo.
barber_expenses: insumos y reembolsos.
loyalty_accounts: resumen de puntos.
loyalty_transactions: libro inmutable de movimientos.
loyalty_rules: reglas configurables.
rewards y reward_redemptions: premios y canjes.
referrals: relacion entre quien refiere y nuevo cliente.
customer_streaks: progreso de rachas.
Las operaciones criticas se ejecutaran mediante funciones SQL transaccionales, con RLS, validacion de rol, idempotencia y auditoria.

55. ORDEN DE DESARROLLO APROBADO
Fase 1: venta unificada, atenciones sin reserva, pagos presenciales informativos y rol/capacidad de cajero.
Fase 2: comprobante interno, QR de vinculacion, apertura y cierre de caja.
Fase 3: comision fija del peluquero, incentivos de productos y liquidaciones.
Fase 4: puntos por servicios completados y catalogo de recompensas.
Fase 5: referidos, rachas y campañas configurables.
Fase 6: insumos, reembolsos y reportes economicos ampliados.
Fase 7: analitica web y atribucion de marketing.
Fase opcional independiente: integracion fiscal SIAT.

CHECKLIST CONSOLIDADO DE ESTADO - 9 DE AGOSTO DE 2026
Leyenda:
[x] Implementado y presente en el proyecto.
[~] Implementacion parcial o pendiente de validacion operativa completa.
[ ] Pendiente de desarrollo o configuracion.

Infraestructura y seguridad:
[x] Proyecto Supabase conectado.
[x] Repositorio GitHub y despliegue Vercel.
[x] Variables publicas de Supabase fuera del codigo fuente.
[x] Autenticacion Google mediante Supabase Auth.
[x] RLS y funciones protegidas para operaciones sensibles existentes.
[x] Separacion de roles cliente, peluquero, administrador y superadmin.
[x] Cuenta dick.nina29@gmail.com exclusivamente como superadmin/desarrollador.
[x] Invitaciones pendientes para administradores antes del primer ingreso Google.
[x] Auditoria de acciones administrativas, caja, devoluciones, ajustes de puntos, gastos y liquidaciones.
[x] Rotar las claves secretas de Supabase y Google OAuth expuestas durante la configuracion inicial.
[ ] Confirmar estrategia automatica de backups y restauracion probada.
[ ] Configurar dominio propio, si el negocio lo requiere.

Sitio publico y contenido:
[x] Identidad visual Barberia LEGEND CLUB.
[x] Informacion real, direccion, WhatsApp, mapa y lema.
[x] Catalogo de servicios desde base de datos.
[x] Equipo/peluqueros desde base de datos.
[x] Galeria administrable desde base de datos.
[x] Productos administrables desde base de datos.
[x] Apartado de productos por 24 horas.
[x] Flujo de entrega/recogida de productos integrado al cobro presencial y actualizacion de stock.
[x] PWA con manifest, registro de service worker y cache limitado a recursos estaticos seguros.

Usuarios y paneles:
[x] Registro automatico de clientes con Google.
[x] Boton de login y fotografia de perfil al iniciar sesion.
[x] Resolucion de panel segun capacidades.
[x] Panel de cliente con citas, apartados y notificaciones.
[x] Panel de peluquero con agenda y cambio de estados permitido.
[x] Panel administrador para agenda, clientes, negocio, servicios, galeria, productos, equipo y administradores.
[x] Sistema visual LEGEND OS compartido para administrador, cajero y peluquero, con sidebar contextual y header operativo.
[x] Sidebar de escritorio dividido en cabecera, navegacion desplazable y pie estable sin superposiciones.
[x] Sidebar de escritorio contraíble a 76 px con control hamburguesa/X accesible, etiquetas retiradas correctamente del layout y botones de navegación con contraste reforzado.
[x] Navegación administrativa ordenada por frecuencia operativa; Negocio y Estadísticas se agrupan al final como herramientas de menor uso.
[x] Formularios de creacion y edicion presentados como componentes modales reutilizables.
[x] Animaciones de entrada, estados, tarjetas y ventanas con alternativa accesible para movimiento reducido.
[x] Tema de panel automatico segun el dispositivo, con seleccion persistente entre sistema, claro y oscuro.
[x] Contraste de textos, fondos, inputs, selects, modales y estados revisado para ambos temas.
[x] Paleta visual privada LEGEND OS v2 aplicada con azul institucional, azul real, índigo, celeste, azul hielo y azul noche; header y sidebar forman una estructura coherente y la página pública permanece sin cambios.
[x] Selector de modos del header corregido para sus enlaces reales, con estados normal, hover y activo claramente diferenciados.
[x] Apariencia integrada como una única opción desplegable del sidebar en todos los roles; muestra Sistema/Claro/Oscuro y se retrae automáticamente al seleccionar. El chat es el único control flotante.
[x] Sidebar administrativo móvil convertido en drawer con hamburguesa, cierre mediante X/Escape/fondo y acción Cerrar sesión ubicada en el pie del menú.
[x] Headers privados optimizados para teléfono en una fila compacta; se ocultan al desplazarse hacia abajo y reaparecen al subir o regresar al inicio.
[x] Patrón móvil unificado para administrador, cajero, peluquero y cliente: hamburguesa y marca no interactiva alineadas a la izquierda, selector de roles transparente mediante tres puntos a la derecha y drawer compartido con navegación, apariencia, sitio público y salida inferior. El header no duplica el acceso al sitio público.
[x] Sistema reutilizable de tarjetas privadas con contorno azul, acento lateral, relieve suave y variantes semánticas azul, verde y naranja para indicadores; no afecta al sitio público.
[x] Alta, vinculación, edición y desactivación de peluqueros; la ficha se crea y aparece inmediatamente aunque la cuenta Google todavía esté pendiente.
[x] Página Equipo agrupada por roles con peluqueros y cajeros activos, invitaciones de cajero pendientes visibles, altas de ambos perfiles y personal inactivo concentrado en un bloque desplegable al final.
[x] Perfil persistente de cajero con estado activo/inactivo e invitación previa al primer ingreso Google para retirar y reactivar acceso sin perder su pertenencia histórica al equipo.
[x] Retroalimentación administrativa mediante toast de éxito o error; las operaciones actualizan los datos con `router.refresh()` sin recargar toda la página y los modales se cierran únicamente al confirmar éxito.
[x] Administracion y bloqueo manual de clientes.
[~] Existe una invitacion administrativa pendiente; falta que el negocio complete y pruebe el ingreso del administrador invitado.
[ ] Confirmar al menos dos administradores operativos si se mantiene la regla de continuidad definida en la guia original.

Reservas y operacion actual:
[x] Seleccion de servicio, peluquero y horario disponible.
[x] Precio y duracion guardados como snapshot en la cita.
[x] Prevencion de superposicion de horarios.
[x] Cancelacion del cliente bajo reglas existentes.
[x] Reasignacion con confirmacion del cliente.
[x] Estados de cita para administrador y peluquero.
[x] Inasistencia y lista negra informativa/manual.
[x] Cierre de emergencia y reprogramacion/notificacion interna a nivel de base de datos.
[x] Notificaciones internas visibles y preferencias configurables por el cliente.
[x] Chat interno solo texto, protegido por participantes y con limite de envio.
[x] Centro de atención flotante estilo mensajería, sin página independiente y con conversaciones separadas por cliente; incorpora búsqueda, fechas separadoras, estado de envío, envío con Enter, compositor fijo y presentación móvil como hoja inferior.
[x] Chat móvil sin identidad duplicada: clientes ven únicamente a LEGEND CLUB; administrador y cajero disponen de un botón de conversaciones recientes ordenadas por el último mensaje.
[x] Modal de chat compacto: en escritorio adopta proporción de teléfono de 390 px y puede arrastrarse desde el encabezado sin salir de la pantalla; en móvil ocupa el viewport visible.
[x] El personal abre primero el historial ordenado por actividad reciente y elige qué cliente atender; el cliente accede directamente a su conversación privada. El envío permanece bloqueado mientras el mensaje esté vacío.
[x] Modal móvil adaptado a las cuatro coordenadas de `visualViewport`: ocupa todo el ancho y queda anclado al borde superior visible; su borde inferior se ajusta dinámicamente al teclado, desplaza únicamente el hilo y recupera el foco al enviar, recibir o tocar una zona no interactiva.
[x] Mensajería conectada a Supabase Realtime incluso con la ventana cerrada, con actualización inmediata de conversaciones y mensajes. Migración `202608100003_chat_realtime_receipts.sql` aplicada en Supabase producción.
[x] Indicador temporal “escribiendo”, alerta sonora de dos tonos para cada mensaje entrante mientras el panel está abierto, contador global y distintivo de mensajes pendientes por contacto.
[x] Confirmaciones de lectura persistentes: un check indica enviado y doble check indica que el destinatario correspondiente abrió la conversación.
[x] Chat privado rediseñado con patrón visual tipo Telegram, lista de contactos, avatar, burbujas diferenciadas y compositor anclado siempre visible en escritorio y móvil.
[x] Clientes aislados entre si; solo el cliente, administradores y cajeros autorizados acceden a cada consulta.
[x] Arquitectura de conversaciones preparada para incorporar un chatbot de soporte en una fase futura.
[x] Registro de atenciones sin reserva y vinculacion posterior del cliente.

Estadisticas:
[x] Pagina Estadisticas dentro del panel administrador.
[x] Comparacion del mes actual con el anterior.
[x] Evolucion mensual de 12 meses.
[x] Usuarios registrados y clientes recurrentes.
[x] Cancelaciones e inasistencias.
[x] Servicios, peluqueros, productos, fechas, dias y horas de mayor demanda.
[x] Proteccion backend exclusiva para administradores.
[x] Valores economicos confirmados desde ventas pagadas, comisiones y participacion del negocio.
[x] Visitas web, fuentes de trafico, UTM, clics de reserva y WhatsApp con consentimiento.

Caja, ventas y comprobantes:
[x] Tablas de ventas, detalle, pagos y comprobantes.
[x] Atencion walk-in o cliente sin reserva.
[x] Rol/capacidad de cajero asignable por administracion.
[x] Registro de efectivo, QR, transferencia, tarjeta y otros pagos presenciales.
[x] Apertura, cierre, monto esperado, conteo y diferencia de caja.
[x] Ingresos y egresos justificados.
[x] Anulaciones, devoluciones, reposicion de stock y reversiones auditadas.
[x] Comprobante interno correlativo y codigo de verificacion.
[x] Vista imprimible y guardado como PDF mediante el navegador.
[x] Codigo QR de vinculacion para cliente invitado.
[x] Flujo seguro y de un solo uso para reclamar una atencion tras autenticarse con Google.

Peluqueros, comisiones e incentivos:
[x] Campo configurable commission_percent en barber_profiles.
[x] Regla operativa inicial de 50% configurable y visible en caja.
[x] Snapshot de porcentaje y comision por servicio vendido.
[x] Comision calculada sobre el precio normal aunque exista descuento.
[x] Bloqueo para cajero y autorizacion administrativa para promociones con perdida del negocio.
[x] Libro historico de comisiones y reversiones.
[x] Dashboard economico del peluquero con pendientes, gastos y liquidaciones.
[x] Cierre por periodos y liquidaciones sin duplicar conceptos.
[x] Peluquero recomendador asociado a venta de producto.
[x] Incentivos configurables por productos entregados y pagados.
[x] Registro, aprobacion y reembolso de insumos.

Fidelizacion:
[x] Libro auditable de movimientos de puntos con claves de idempotencia.
[x] Saldo e historial visible para el cliente.
[x] Reglas configurables para ganar puntos.
[x] Puntos acreditados solo por servicios completados y pagados.
[x] Catalogo administrable de recompensas.
[x] Canje seguro, cancelacion y reversion de puntos.
[x] Vencimiento configurable y actualizacion automatica al consultar la cuenta.
[x] Codigo y QR personal de referido.
[x] Validacion de primera compra pagada del referido.
[x] Proteccion contra autorreferidos y duplicados.
[x] Rachas configurables de asistencia.
[x] Campañas y promociones por codigo, vigencia, limite de usos y tope de descuento.

Configuracion inicial adoptada, editable por administracion:
[x] 10 puntos por servicio pagado.
[x] 1 punto por cada Bs 10 en productos pagados.
[x] 5 puntos de bienvenida.
[x] 20 puntos para quien refiere y 10 para el nuevo cliente.
[x] Vencimiento inicial a 12 meses.
[x] Recompensas iniciales de 20% y 50% con limites de descuento.
[x] Racha inicial de 3 visitas dentro de 35 dias y bonificacion de 5 puntos.
[x] Incentivo inicial de 10% por venta recomendada de producto.
[x] Periodicidad flexible mediante seleccion de fecha inicial y final de liquidacion.
[x] Insumos sujetos a revision administrativa antes del reembolso completo.
[~] La administracion debe designar las cuentas concretas que tendran capacidad de cajero.
[x] Formas registrables: efectivo, QR, transferencia, tarjeta y otro.
[ ] Factura fiscal e integracion SIAT: fuera del alcance actual; requiere proyecto y autorizacion separados.

Validacion tecnica y operativa:
[x] Lint, TypeScript y compilacion de produccion completados localmente.
[x] Migraciones 202608090002 a 202608090004 aplicadas en Supabase de produccion.
[x] Migracion 202608100001 de soporte privado para administradores y cajeros aplicada en produccion.
[x] Migración 202608100004 de altas consistentes e invitaciones del equipo aplicada y verificada en Supabase producción.
[x] Rutas /caja y /vincular/[code] comprobadas en Vercel de produccion.
[x] /mensajes redirige al panel y la mensajeria se presenta exclusivamente como ventana flotante.
[x] Paquete de produccion verificado con tema claro, tema oscuro, chat flotante y sidebar desplazable sin superposiciones.
[x] Lint, TypeScript y compilación de producción repetidos después del rediseño cromático y la corrección estructural del chat.
[x] Datos iniciales de recompensas comprobados y acceso anonimo a caja rechazado por backend.
[x] Restricciones transaccionales contra cobro duplicado de una cita, canjes duplicados y liquidaciones duplicadas.
[~] Ejecutar prueba operativa en produccion de comisiones con promociones de 0%, 20%, 50% y descuento extraordinario.
[~] Ejecutar prueba operativa en produccion de cancelacion, anulacion y devolucion.
[~] Ejecutar prueba operativa en produccion de cierre de caja con diferencias.
[~] Ejecutar prueba concurrente en produccion de puntos, canjes y reversiones.
[~] Ejecutar prueba antifraude completa con dos cuentas Google reales.
[~] Ejecutar vinculacion completa con cliente invitado y una segunda cuenta Google.
[~] Ejecutar matriz RLS con cuentas reales de cajero, peluquero, administrador, cliente y superadmin.
[~] Conciliar una liquidacion real contra ventas y gastos del periodo.

56. NAVEGACION MODULAR DEL PERSONAL (12 DE AGOSTO DE 2026)

[x] El panel del peluquero utiliza pantallas independientes en lugar de concentrar todas las funciones en una sola pagina.
[x] `/barbero` funciona como dashboard y agenda diaria.
[x] `/barbero/perfil` permite editar la informacion publica y fotografia del peluquero.
[x] `/barbero/balance` presenta comisiones, incentivos, gastos y liquidaciones.
[x] `/barbero/trabajos` administra las publicaciones propias del peluquero.
[x] El panel de Caja utiliza pantallas independientes para servicios, productos, libro diario, liquidaciones, gastos e historial.
[x] `/caja` prioriza la cola de cobros de servicios y las atenciones sin reserva.
[x] `/caja/productos` registra ventas independientes de productos.
[x] `/caja/movimientos` contiene apertura, movimientos con glosa, cierre e impresión del libro diario.
[x] `/caja/liquidaciones` prepara y paga liquidaciones diarias.
[x] `/caja/gastos` revisa gastos e insumos del equipo.
[x] `/caja/historial` muestra ventas, comprobantes y reversiones.
[x] Los sidebars del peluquero y cajero usan rutas reales y conservan el indicador de opcion activa.
[x] Se elimino Modo cliente de los paneles del personal del negocio.
[x] Las cuentas administrativas, de caja o peluqueria que intentan abrir `/mi-cuenta` son redirigidas a su panel laboral.
[x] TypeScript y ESLint verificados despues de la reorganizacion modular.

58. ENDURECIMIENTO VISUAL Y DE SEGURIDAD (12 DE AGOSTO DE 2026)

[x] Contraste explicito para campos, codigos, placeholders y botones deshabilitados del portal privado.
[x] Selector de apariencia reducido a iconos con nombres accesibles para lectores de pantalla.
[x] Variables de entorno preferidas para URL y publishable, con respaldo exclusivamente público para no romper el despliegue; ninguna clave secreta en cliente.
[x] Confirmado que no existen claves secretas de Supabase o Google dentro del repositorio ni su historial.
[x] Cabeceras HTTP de seguridad configuradas globalmente.
[x] Dependencias de produccion auditadas con cero vulnerabilidades conocidas.
[x] Insercion anonima de analitica no utilizada revocada.
[x] Limites de abuso para codigos de comprobante, reservas, apartados, canjes y mensajes.
[x] Analizador de base enlazada ejecutado y error de la funcion de caja corregido.
[x] Migracion `202608120001_security_hardening.sql` aplicada en Supabase produccion.
[x] Informe tecnico documentado en `SECURITY_AUDIT.md`.
[ ] Configurar dominio personalizado de Supabase si se desea sustituir `supabase.co` en la pantalla OAuth.
[ ] Confirmar CAPTCHA/Turnstile y limites de Auth desde el dashboard de Supabase.
[ ] Configurar regla WAF de Vercel para abuso L7 de login y reservas.

59. FLUJO DE ATENCION, COBRO Y LIBRO DIARIO (12 DE AGOSTO DE 2026)

[x] La venta exclusiva de productos está separada del cobro de servicios.
[x] El formulario de servicio inicia sin producto y ofrece un check para añadirlo cuando corresponda.
[x] Caja puede corregir el servicio reservado antes del pago.
[x] Caja puede añadir un servicio extra y un producto imprevisto antes de emitir el comprobante.
[x] El peluquero puede informar servicio realizado, servicio extra, producto, cantidad y observación.
[x] Al finalizar la atención, el peluquero la envía a estado `pending_payment` en vez de marcarla pagada o completada.
[x] La cita pendiente aparece en la cola de caja y se actualiza mediante Realtime.
[x] La atención solo cambia a `completed` después de registrar el pago.
[x] Los servicios adicionales mantienen la comisión configurada del peluquero sobre su precio normal.
[x] Los descuentos y promociones siguen reduciendo la participación del negocio, no la comisión del peluquero.
[x] El dashboard principal de caja muestra cantidades operativas, sin saldos ni totales monetarios visibles.
[x] El libro diario registra ventas, ingresos, egresos, devoluciones y ajustes con fecha, método y glosa.
[x] El libro diario puede imprimirse para la rendición al final del turno.
[x] El cierre y conciliación del turno se realiza desde el libro diario.
[x] Migración `202608120002_cashier_queue_and_daily_ledger.sql` creada con políticas RLS y funciones transaccionales.
[x] Migración `202608120002_cashier_queue_and_daily_ledger.sql` aplicada en Supabase producción.
[x] Ajuste `202608120003_cashier_claim_code_search_path.sql` aplicado y RPC nuevo validado sin errores.
[ ] Probar en producción el circuito completo: reserva, inicio, envío a caja, cambio de servicio, extra, producto, cobro y comprobante.
[ ] Verificar impresión física o PDF del libro diario con una jornada real.

FUERA DE ALCANCE DE LA AMPLIACION ACTUAL
Procesamiento de pagos online.
Pasarela de pagos.
Contabilidad fiscal completa.
Facturacion fiscal sin integracion y autorizacion del SIN.
WhatsApp API automatizado de pago.
SMS.
Email transaccional obligatorio.
Chat con imagenes.
App nativa en tiendas.
Multi-sucursal.
Los puntos, comisiones y caja de esta lista historica fueron trasladados posteriormente a la ampliacion aprobada. Consultar las secciones 43 a 55 y el checklist consolidado.
Multi-tenant para otras peluquerias, salvo decision futura.
IA para recomendaciones.
Pruebas virtuales de estilos.
NOTAS FINALES PARA EL DESARROLLADOR
Mantener el sistema simple.
No agregar servicios de pago sin aprobacion.
Priorizar experiencia movil.
Optimizar imagenes desde el inicio.
No guardar imagenes en base de datos.
Usar soft delete para entidades importantes.
Registrar auditoria en acciones administrativas.
Validar roles y permisos en backend.
Documentar cambios de base de datos.
Probar flujos criticos antes de entregar.
Mantener notificaciones internas simples.
Mantener chat simple y seguro.
Evitar sobreingenieria.
Preparar el sistema para crecer, pero sin complicar el MVP.
RESUMEN EJECUTIVO
El sistema es una web app movil desarrollada con Next.js, desplegada en Vercel y conectada a Supabase.
Los usuarios se autentican con Google. Los clientes se registran solos, los peluqueros y administradores se habilitan mediante invitaciones protegidas y el desarrollador conserva exclusivamente el rol superadmin tecnico.
La version actualmente desplegada incluye sitio publico, reservas, catalogos, apartados de productos, paneles por rol, gestion administrativa, notificaciones internas y estadisticas operativas protegidas.
La ampliacion implementada agrega caja presencial, atenciones sin reserva, comprobante interno, comisiones del peluquero sobre el precio normal, incentivos de productos, puntos, referidos, rachas, insumos y liquidaciones.
El peluquero mantendra 50% del precio normal completo del servicio aunque administracion aplique una promocion. El descuento reducira exclusivamente la participacion del negocio.
La ampliacion no procesa pagos online ni sustituye un sistema contable o fiscal. Una futura factura fiscal requerira un proyecto de integracion autorizado con el SIN.
El checklist consolidado de este documento debe actualizarse despues de cada migracion, despliegue y validacion funcional.
Fin del documento.
