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
El sistema no manejara pagos online, caja ni contabilidad en esta version.
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
No incluira en esta version:
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
FUERA DE ALCANCE EN V1
Pagos online.
Caja.
Contabilidad.
Facturacion.
Comisiones avanzadas.
Membresias complejas.
Programa de puntos avanzado.
WhatsApp API automatizado.
SMS.
Email automatico obligatorio.
Chat con imagenes.
App nativa en tiendas.
Multi-sucursal.
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
El sistema sera una web app movil tipo PWA, desarrollada con React en Vercel y Supabase como backend.
Los usuarios se autentican con Google. Los clientes se registran solos. Los peluqueros son registrados o habilitados por el administrador. Habra dos administradores con mismos permisos, y un superadmin tecnico.
El sistema prioriza la vista peluquero para usuarios administradores que tambien atienden. Permite reservas con telefono confirmado, buffer de 5 minutos, tiempo de gracia, cancelaciones con 2 horas, lista negra no automatica, reasignaciones con confirmacion del cliente, cierre por emergencia, galeria autorizada, productos con apartado de 24 horas, chat solo texto y notificaciones internas.
No manejara pagos online, caja ni contabilidad. Se apoyara en WhatsApp manual solo como canal de contacto, sin API pagada.
Fin del documento.
