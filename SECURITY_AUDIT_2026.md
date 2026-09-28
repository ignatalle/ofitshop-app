# Auditoría de seguridad — Outfit Shop 2026

## Alcance verificado en el repositorio

La app actual es un backoffice que crea el cliente de Supabase en el navegador con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

No hay un flujo de Supabase Auth implementado en el código actual (login, sesión o usuario autenticado).

La migración de `pending_purchases` habilita RLS pero mantiene una policy temporal `FOR ALL TO anon USING (true) WITH CHECK (true)`.

Varias RPC críticas usan `SECURITY DEFINER` y actualmente conceden `EXECUTE` al rol `anon`, porque el backoffice todavía no usa autenticación.

## Riesgo

Esto es compatible con el funcionamiento actual, pero NO debe considerarse una configuración final para exponer el backoffice como aplicación pública o multiusuario.

La anon key no es un secreto: está diseñada para estar en el cliente. La seguridad real debe depender de Auth + RLS/policies correctas.

No se cerraron las policies ahora porque hacerlo sin implementar Auth primero rompería pedidos, abonos y compras pendientes.

## Plan seguro antes de una tienda pública

1. Implementar Supabase Auth para las personas autorizadas al backoffice.
2. Cambiar escrituras de orders, transactions, customers, products, suppliers y pending_purchases a rol authenticated con policies restrictivas.
3. Revocar EXECUTE a anon para RPC financieras y concederlo solamente a authenticated.
4. Mantener cualquier catálogo público en una vista/endpoint de solo lectura con las columnas estrictamente necesarias.
5. Revisar policies del bucket product-images.
6. Probar que un visitante sin sesión no pueda leer clientes, deuda, caja, costos ni ejecutar mutaciones.

## Limitación de esta auditoría

El repositorio no contiene el esquema/policies completo de todas las tablas existentes en el proyecto Supabase. Por eso las policies de orders, transactions, customers, products y suppliers deben verificarse directamente en el proyecto antes de cerrar este punto.

Estado: riesgo identificado y documentado. No se aplicaron cambios destructivos de permisos.
