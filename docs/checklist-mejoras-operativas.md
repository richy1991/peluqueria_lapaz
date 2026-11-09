# Checklist de mejoras operativas y de experiencia

Usar este documento para dar seguimiento a las tareas solicitadas. Las casillas
marcadas indican funcionalidades aplicadas en el código; las tareas de prueba
permanecen pendientes hasta ejecutarse en un entorno con dependencias y datos.

## 1. Registro de ventas directas

- [x] Permitir agregar varios productos en una misma venta.
- [x] Permitir agregar productos nuevos y productos extras como detalles de la
      venta.
- [x] Permitir cambiar cantidades y eliminar detalles antes de cobrar.
- [x] Calcular y actualizar el precio total en tiempo real al agregar, quitar o
      modificar cada detalle.
- [x] Mostrar claramente el total a pagar antes de confirmar el cobro.
- [x] Mantener la venta atómica: no registrar cobros parciales si la operación
      falla.
- [ ] Probar una venta con varios productos, cantidades distintas y productos
      extras.

## 2. Compra de productos: puntos y comisión fija

- [x] Otorgar 5 puntos al cliente por cada producto comprado.
- [x] Acreditar 5 Bs al peluquero por cada producto vendido.
- [x] Sustituir el cálculo porcentual anterior por el monto fijo de 5 Bs por
      producto.
- [x] Mostrar en el comprobante y en los saldos los puntos y el incentivo
      generados.
- [ ] Evitar otorgar puntos o incentivos duplicados al reintentar o revertir una
      venta.
- [ ] Probar ventas de uno y varios productos y verificar los saldos resultantes.

## 3. Canje de 50 puntos

- [x] Agregar la opción de canjear 50 puntos.
- [x] Aplicar el canje de 50 puntos como 50 % de descuento del servicio.
- [x] Descontar únicamente los puntos canjeados del saldo del cliente.
- [x] Mostrar de forma notoria el canje y el descuento aplicado en tiempo real
      durante el cobro en caja.
- [x] Impedir el canje si el cliente no tiene suficientes puntos.
- [x] Mantener la opción existente de canje de 100 puntos.
- [ ] Probar el canje de 50 puntos, la actualización del saldo y la reversión de
      una operación fallida.

## 4. Referidos y fidelización por peluquero

- [x] Otorgar 10 puntos iniciales al cliente nuevo referido.
- [x] Otorgar 10 puntos al cliente que realizó la recomendación.
- [x] Asociar la fidelización al peluquero que atiende al cliente, no solo al
      cliente de forma global.
- [x] Si el referido es atendido por el peluquero de preferencia del
      recomendador, registrar la fidelización y entregar las recompensas.
- [x] Si el referido es atendido por otro peluquero, registrarlo como cliente
      nuevo de ese peluquero sin recompensa de 10 puntos por referido.
- [x] Otorgar a todo cliente nuevo 10 puntos con el peluquero que lo atendió.
- [x] Evitar recompensas duplicadas por el mismo referido.
- [ ] Probar los escenarios de referido con el peluquero preferido y con otro
      peluquero.

## 5. Cobro en caja tipo carrito

- [x] Reemplazar el formulario de cobro por una interfaz tipo carrito.
- [x] Permitir agregar servicios y productos en una misma cuenta.
- [x] Permitir modificar cantidades, quitar conceptos y revisar el detalle.
- [x] Mostrar la suma total automáticamente después de cada cambio.
- [x] Mostrar el cliente seleccionado y sus beneficios aplicables antes del cobro.
- [x] Mostrar el total final después de descuentos y canjes, separado del
      subtotal.
- [x] Diseñar una interfaz intuitiva, legible y optimizada para computadora.
- [x] Confirmar el cobro solo después de mostrar claramente el total final.
- [ ] Probar cobros con servicios, productos, descuentos y canjes combinados.

## 6. Liquidaciones e incentivos del peluquero

- [x] Mostrar saldo de liquidación pendiente igual a 0 cuando todo haya sido
      liquidado.
- [x] Restar del saldo los pagos ya liquidados.
- [x] Mostrar únicamente las comisiones o incentivos que todavía estén
      pendientes de liquidación.
- [x] Organizar el panel de caja por peluquero.
- [x] Mostrar en el panel del peluquero el saldo pendiente de forma clara.
- [x] Agregar una tabla con las últimas liquidaciones, incluyendo fecha, monto,
      conceptos y estado.
- [ ] Mostrar la misma información de forma transparente para caja y peluquero.
- [ ] Probar liquidaciones completas, parciales y sin saldo pendiente.

## 7. Historial de ventas

- [x] Crear un historial de ventas visible y fácil de encontrar.
- [x] Mostrar fecha, cliente, peluquero, productos, servicios, descuentos,
      puntos, total y estado del cobro.
- [x] Permitir consultar el detalle de cada venta y su comprobante.
- [x] Agregar filtros por fecha, cliente, peluquero y tipo de venta.
- [x] Diferenciar ventas pagadas, anuladas y revertidas.
- [ ] Verificar que el historial coincida con los movimientos de caja.

## 8. Descuento VIP de 5 Bs

- [x] Al seleccionar un cliente en caja, mostrar a un costado su historial de
      visitas.
- [x] Mostrar las visitas realizadas durante el mes actual.
- [x] Permitir que el cajero aplique manualmente el descuento VIP de 5 Bs.
- [x] Mostrar el descuento aplicado en tiempo real antes de confirmar el cobro.
- [x] Registrar quién aplicó el descuento y en qué venta.
- [x] Evitar aplicar el descuento más de una vez en la misma venta.
- [ ] Probar clientes con y sin visitas recientes.

## 9. Promoción manual para días de baja demanda

- [x] Mantener la promoción manual existente.
- [x] Eliminar el tope de precio.
- [x] Eliminar el límite de uso.
- [x] Permitir definir el precio promocional vigente para el servicio.
- [x] Mostrar la promoción activa en el panel del cliente.
- [x] Enviar una notificación cuando corresponda.
- [x] Mostrar claramente la vigencia y el precio promocional.
- [ ] Probar la activación, visualización y desactivación de una promoción.

## 10. Catálogo de servicios

- [x] Modificar el modal de edición del servicio.
- [x] Eliminar el campo de identificador innecesario.
- [ ] Usar el nombre del servicio como identificador visible.
- [ ] Verificar que crear, editar, listar y seleccionar servicios siga funcionando.
- [ ] Confirmar que no se rompan las referencias internas existentes al eliminar
      el campo del formulario.

## 11. Citas en el panel del peluquero

- [x] Reflejar en el panel del peluquero las citas solicitadas por los clientes.
- [x] Actualizar la agenda después de crear, cambiar o cancelar una cita.
- [x] Agregar una vista de citas del día.
- [x] Agregar un apartado de citas de la semana.
- [x] Mostrar cliente, hora, servicio, estado y observaciones relevantes.
- [x] Ordenar las citas cronológicamente y diferenciar sus estados.
- [ ] Probar la actualización de la agenda desde el flujo del cliente.

## 12. Eliminación de gastos del peluquero

- [x] Eliminar la opción de registrar gastos del peluquero.
- [x] Retirar el acceso y los enlaces del panel del peluquero.
- [x] Retirar el acceso y los enlaces del panel de caja.
- [x] Eliminar los formularios, acciones y componentes relacionados.
- [ ] Revisar permisos, consultas, funciones y migraciones relacionadas.
- [x] Conservar los datos históricos únicamente si son necesarios para auditoría
      o liquidaciones.

## 13. Saldo del peluquero

- [x] Rediseñar el resumen de saldo para que sea claro y entendible.
- [x] Separar saldo pendiente, comisiones por venta, incentivos por productos y
      montos ya liquidados.
- [ ] Mostrar el saldo actualizado después de cada cobro y liquidación.
- [x] Organizar en caja el saldo por peluquero.
- [x] Usar etiquetas y estados consistentes en ambos paneles.
- [ ] Verificar que los totales del panel coincidan con el historial de
      liquidaciones.

## 14. Logo y paneles móviles

- [x] Reemplazar el logo mostrado al instalar la aplicación.
- [x] Actualizar los iconos y recursos de la PWA con el nuevo logo.
- [x] Rediseñar el panel del peluquero para uso exclusivo desde teléfono.
- [x] Rediseñar el panel del cliente para uso exclusivo desde teléfono.
- [x] Aplicar una interfaz profesional y atractiva basada en patrones de
      componentes tipo Shadcn/ui.
- [x] Evaluar y aplicar componentes y patrones de Figma Make y 21st.dev sin romper la
      identidad visual de la aplicación.
- [x] Optimizar navegación, tarjetas, estados, formularios y acciones para
      pantallas pequeñas.
- [ ] Verificar accesibilidad, contraste, estados de carga y mensajes de error.
- [ ] Probar los paneles en tamaños móviles reales y en modo instalado como PWA.
- [x] Agregar un botón visible para instalar la app desde el sitio público y
      después de iniciar sesión, con instrucciones alternativas para iOS.
- [x] Adaptar la instalación a Android, Huawei, iOS/iPadOS y navegadores de
      escritorio usando el permiso y diálogo nativos disponibles en cada sistema.
- [x] Iniciar la PWA directamente en el panel de usuario mediante `/panel`,
      dejando la landing pública disponible solo cuando se solicita manualmente.
- [x] Solicitar confirmación del navegador antes de cerrar o abandonar la app
      instalada desde un panel autenticado.

## 15. Marketing digital y notificaciones

- [x] Definir los eventos que deben generar notificaciones: promociones,
      recordatorios, citas, puntos, canjes y novedades.
- [x] Implementar el sistema de notificaciones para clientes y peluqueros según
      su rol.
- [x] Mostrar las notificaciones dentro de la aplicación.
- [x] Agregar preferencias para activar o desactivar cada tipo de notificación.
- [x] Configurar notificaciones push cuando el dispositivo y el permiso lo
      permitan.
- [x] Evitar notificaciones duplicadas mediante una clave de deduplicación.
- [ ] Crear campañas para promocionar automáticamente promociones y beneficios
      relevantes.
- [ ] Probar permisos, preferencias, lectura y entrega de notificaciones.

## 16. Validación final

- [ ] Ejecutar lint y build de producción.
- [ ] Ejecutar las pruebas automatizadas existentes.
- [ ] Probar los flujos principales con roles de cliente, peluquero y cajero.
- [ ] Verificar reglas de autorización y RLS para cada operación nueva.
- [ ] Verificar que los cálculos de puntos, descuentos, comisiones y
      liquidaciones sean consistentes en frontend, backend y comprobantes.
- [ ] Revisar la experiencia en computadora para caja y en teléfono para cliente
      y peluquero.
- [ ] Registrar fecha, responsable y evidencia de cada tarea completada.

## Registro de avance

| Fecha | Responsable | Sección revisada | Resultado | Observaciones |
|---|---|---|---|---|
| 2026-11-09 | Copilot | Auditoría de implementación local | Parcial | Se marcaron funcionalidades aplicadas; las pruebas y tareas sin evidencia permanecen pendientes. |
