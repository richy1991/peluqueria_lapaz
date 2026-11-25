# Barbería LEGEND CLUB

Sitio público y sistema de reservas de Barbería LEGEND CLUB, definidos a partir de `guia_de_desarrollo.md`.

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

## Diseño web de LEGEND CLUB

Esta referencia describe la portada, los productos públicos, el acceso con Google, la reserva y las pantallas rediseñadas del cliente. Los valores base están en [app/globals.css](app/globals.css).

| Uso | Variable | Color |
| --- | --- | --- |
| Fondo oscuro | `--public-ink` | `#10131B` |
| Paneles | `--public-surface` | `#191F2A` |
| Tarjetas y controles elevados | `--public-card` / `--public-raised` | `#222A36` / `#293341` |
| Texto principal y secundario | `--public-text` / `--public-muted` | `#F6F2EB` / `#C3C7CF` |
| Acento para iconos, selecciones y detalles | `--public-accent` | `#FF9B66` |
| Acción principal y estado al pasar el cursor | `--public-action` / `--public-action-hover` | `#FF7938` / `#FF9258` |
| Bordes y divisores | `--public-line` | `#A3B0C33D` |

- **Forma y tipografía.** Logotipo original, controles redondeados de alrededor de 10–12 px, tarjetas de 14–19 px y paneles amplios de 20–28 px. La portada combina títulos serif y texto sans serif. La reserva y el perfil usan títulos sans serif. El ticket usa números monoespaciados en el folio y el importe.
- **Fondos y estados.** Las diagonales discretas y los arcos del flujo de reserva usan los mismos grises y naranjas con transparencia. En la reserva, el verde `#8ADDB1` indica confirmación y el rosa `#FFAAAA` indica errores. El ticket usa un panel oscuro con borde troquelado y divisores punteados. [Estilos de reserva](app/reservar/booking.css).
- **Navegación.** Cabecera pública fija con transparencia y desenfoque. La línea ámbar `#FFB55C` señala la sección activa. [Estilos de navegación](components/site-header.css).
- **Movimiento en la portada.** Las entradas se vuelven a reproducir cuando los bloques salen de pantalla y se vuelven a ver. Los títulos y las fotos se revelan con recortes y desplazamientos, las tarjetas del equipo se acomodan desde lados alternos y los precios pasan por dígitos aleatorios antes de fijarse en unos 800 ms. La foto de portada puede quedar fija mientras pasa el contenido. [Estilos de portada](app/home.css), [animaciones al desplazar](components/home-scroll-effects.tsx).
- **Movimiento en la reserva.** Entradas cortas al cambiar de paso, desplazamiento al mostrar otra semana y ajuste de altura al cargar horarios. Al confirmar se dibuja el check verde, se muestra durante 1,6 s y después entra el ticket. Los efectos principales respetan el ajuste de movimiento reducido. [Estilos de reserva](app/reservar/booking.css), [confirmación](app/reservar/booking-success.tsx).
- **Movimiento en todo el rediseño.** Para dar una pantalla por terminada, comprueba su entrada al abrirla y las transiciones de menús, ventanas y pestañas. Las animaciones al desplazar deben repetirse cuando la sección vuelva a entrar en vista. Revisa el resultado en escritorio y celular con y sin la preferencia de movimiento reducido. [Animaciones de Mi perfil](app/mi-cuenta/perfil/profile.css).
- **Diseño adaptable.** Tarjetas centradas y columnas aprovechables en escritorio. En pantallas estrechas se apilan las secciones y se conservan los botones cómodos de pulsar. El perfil ofrece los temas Sistema, Claro y Oscuro. El tema claro del perfil usa fondo `#F2EFEB`, paneles `#FFFDF9` y acento `#A34520`. [Estilos del perfil](app/mi-cuenta/perfil/profile.css).

### Lista de rediseño

Cada casilla incluye la pantalla y sus pestañas, botones, formularios y ventanas. Se marca después de revisar su funcionamiento y sus transiciones en escritorio y celular, incluidos los mensajes de carga, error y confirmación que correspondan.

- Web pública
  - [x] Portada, cabecera, pie de página y animaciones al deslizar
  - [x] Acceso a la portada desde `/` con sesión iniciada
  - [x] Catálogo público y carrito
  - [x] Acceso con Google
  - [x] Notificaciones en la cabecera de Inicio
  - [ ] Contenido de la galería pública
- Reserva web
  - [x] Servicio y barbero
  - [x] Fecha y hora
  - [x] Revisión y confirmación
  - [x] Check de confirmación y ticket
- Panel de cliente
  - [x] Mi perfil con próxima cita, accesos, datos personales y ajustes
  - [x] Mi historial y detalle de la cita
  - [x] Editar perfil
  - [x] Productos y apartados
  - [x] Puntos y recompensas
  - [ ] Galería de trabajos
  - [ ] Configuración de avisos
- Panel de barbero
  - [ ] Agenda
  - [ ] Perfil
  - [ ] Trabajos
  - [ ] Productos
  - [ ] Balance
- Administración
  - [x] Acceso y navegación. Inicio con Google, aviso de permisos, menú lateral, cambio de modo, apariencia y cierre de sesión.
  - [x] Agenda. Listado de citas, confirmar, reprogramar, cancelar y ventana para reasignar barbero o cambiar horario.
  - [x] Clientes. Búsqueda, paginación, ficha, bloqueo con motivo, desbloqueo, baja, reactivación y eliminación.
  - [ ] Equipo. Fichas de peluqueros, invitaciones y accesos de peluqueros y cajeros, personal inactivo y reactivación.
  - [x] Horarios. Días de atención, apertura, cierre, turnos y pausa entre turnos.
  - [ ] Servicios. Catálogo, alta, edición y eliminación.
  - [ ] Productos. Búsqueda, filtros de inventario, ficha, alta, edición, categorías, imágenes y eliminación.
  - [ ] Galería. Publicaciones, carga de fotos, edición y eliminación.
  - [ ] Caja y fidelización. Reglas y ajustes de puntos, promociones, recompensas, comisiones e incentivos.
  - [ ] Estadísticas. Resúmenes operativos, económicos y de marketing.
  - [ ] Negocio. Configuración de la información pública y del estado del local.
  - [ ] Mi perfil de administrador.
  - [ ] Administradores. Alta y gestión de accesos.
- Caja
  - [ ] Acceso y navegación. Menús de escritorio y celular, cambio de modo, apariencia y cierre de sesión.
  - [ ] Turno de caja. Estado de la terminal, ventana de apertura y cierre con conciliación.
  - [ ] Cobro de servicios. Cola de pendientes, revisión y cobro, atención sin reserva, búsqueda o registro de cliente, servicios adicionales, descuentos y pago.
  - [ ] Venta de productos. Venta directa, carrito, cantidades, cliente y confirmación de pago.
  - [ ] Reservas de productos. Apartados pendientes y vencidos, cobro y entrega.
  - [ ] Libro diario. Resumen, registro de ingresos, egresos y ajustes, e impresión.
  - [ ] Liquidaciones. Listado, detalle por peluquero, preparación, incentivos, confirmación de pago e historial.
  - [ ] Historial de ventas. Filtros por fecha, detalle y reversión con motivo.
  - [ ] Comprobante de venta. Vista del ticket, impresión y código o QR de vinculación cuando corresponda.
- Pantallas compartidas
  - [ ] Chat de soporte
  - [ ] Vincular compras con puntos
- App nativa
  - [ ] Pantallas y navegación del cliente
  - [ ] Pantallas y navegación del barbero

## Horarios con descanso

En `/admin/horarios`, usa **Editar** para abrir un día. **Atender este día** controla si hay atención y **Agregar turno** habilita el turno de la tarde. La pausa se calcula entre el cierre del primer turno y la apertura del segundo. **Quitar turno** deja una sola jornada. Los cambios se publican con **Guardar horarios**.

Antes de guardar turnos, aplicar `supabase/migrations/202610230001_business_hours_shifts.sql` mediante el flujo de migraciones. Los horarios guardados anteriormente se conservan sin añadir un descanso automáticamente. La migración también excluye las reservas durante el descanso y las citas que lo atraviesan.

Pruebas de horarios (Node 22.18 o posterior): `node --test tests/business-hours.test.mjs`. Las pruebas de base de datos están en `supabase/tests/business_hours_shifts.sql`, para ejecutarlas en Supabase local o una base desechable con las migraciones aplicadas.

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
4. En **Authentication > URL Configuration**, registrar los callbacks de desarrollo:
   `http://localhost:3000/auth/callback` y `http://127.0.0.1:3000/auth/callback`.
5. Al desplegar, agregar también `https://TU_DOMINIO/auth/callback` y configurar el Site URL de producción.

El Client Secret de Google debe guardarse únicamente en Google/Supabase; no pertenece a `.env.local` ni al repositorio.
