# Fichas y eliminación administrativa

Las listas de clientes, productos, servicios, galería y peluqueros abren una ficha con sus acciones. En clientes, **Dar de baja** sigue siendo reversible; **Eliminar** borra la cuenta. Los indicadores del inventario filtran por todos, con existencias o agotados y se combinan con la búsqueda.

## Antes de desplegar

Aplicar `supabase/migrations/202610150001_admin_permanent_deletion.sql` antes de desplegar el código que consulta los nuevos campos históricos. La migración agrega la función `admin_delete_record` y amplía `admin_list_clients`; por sí sola no elimina registros.

## Comportamiento del borrado

- Solo administradores pueden ejecutar la función. No permite eliminar la propia cuenta ni usar la acción de clientes para borrar cuentas del personal.
- Cliente: elimina el usuario de autenticación, su perfil y datos dependientes. Las ventas y citas cerradas conservan los datos necesarios para su historial.
- Peluquero: elimina su perfil laboral, invitación y rol de peluquero. Su cuenta personal y otros roles se conservan.
- Producto o servicio: elimina el registro del catálogo y desactiva las recompensas que lo utilizan. Los comprobantes conservan sus nombres e importes originales.
- Galería: elimina la publicación. Tras borrar productos o publicaciones, la interfaz también solicita retirar sus imágenes de Storage; informa si la limpieza de archivos falla.
- Las citas, reservas vigentes, ventas, canjes o liquidaciones pendientes deben resolverse antes de eliminar los registros relacionados. La función explica el impedimento y revierte la operación completa si falla una relación.
- Las ventas, cobros, comisiones y liquidaciones históricas se conservan. Los nombres históricos permiten mostrarlos después de eliminar al peluquero o cliente.

## Verificación de base de datos

Después de aplicar las migraciones en una base local o desechable:

```powershell
psql $env:LOCAL_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/admin_permanent_deletion.sql
```

El script crea datos de prueba dentro de una transacción y termina con `ROLLBACK`. Cubre permisos, bloqueos por operaciones pendientes, los cinco tipos de eliminación, conservación del historial y devoluciones posteriores. No debe ejecutarse contra producción.
