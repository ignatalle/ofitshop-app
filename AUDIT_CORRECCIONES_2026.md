# Auditoría integral — Correcciones 2026

Objetivo: dejar Outfit Shop estable, matemáticamente consistente y usable en iPhone/Android antes de seguir agregando funciones.

## Prioridad 0 — Reglas que no se deben romper
- Montos internos en centavos enteros.
- Caja total = Efectivo + Virtual.
- Transferencias internas cambian cuentas, no ganancia.
- Compra de mercadería cambia caja, pero no se descuenta otra vez como gasto operativo si el CMV ya se reconoce en la venta.
- Retiros personales cambian caja, no gasto operativo.
- Venta = pedido válido creado en el período.
- Cobrado = pagos reales de clientes.
- Pagado y entregado son estados distintos.
- El costo histórico guardado en el pedido tiene prioridad.
- Timezone: America/Argentina/Buenos_Aires.

## Fase 1 — Matemática y finanzas
- [ ] Verificar unidad monetaria y eliminar ambigüedad pesos/centavos.
- [~] Auditar ventas, CMV, comisiones, gastos operativos, caja y deuda — fórmulas base revisadas; falta contraste final con datos reales de Supabase.
- [x] Auditar pagos parciales, sobrepagos, anulaciones y pedidos cancelados.
- [ ] Revisar clasificación de ingresos para que "Cobros" no incluya ingresos que no sean pagos de clientes.
- [x] Revisar costos faltantes e histórico de costos — Costos Pendientes queda reservado a históricos; compras actuales se resuelven con Caja en Compras Pendientes.
- [ ] Agregar pruebas para todos los invariantes.

## Fase 2 — Datos y estructura
- [ ] Auditar orders/items, transactions, customers, products, pending_purchases y suppliers.
- [x] Revisar migraciones, triggers y RPC — pedido, abonos y Compras Pendientes usan RPC atómicas; hardening aplicado en Supabase.
- [ ] Detectar duplicaciones de lógica entre páginas.
- [ ] Reducir dependencias de textos/descripciones para clasificar movimientos.
- [ ] Revisar RLS/permisos antes de cualquier tienda pública.

## Fase 3 — Flujos funcionales
- [x] Nuevo pedido / Carga rápida — RPC aplicada y frontend conectado de forma atómica.
- [x] Abonos y pagos globales — RPC aplicada y frontend conectado de forma atómica.
- [x] Cambios de estado y entrega — estados válidos controlados, anulados excluidos de pendientes/completados y listado abre la ficha real del pedido.
- [x] Gastos, transferencias y retiros — montos validados, transferencias limitadas al saldo disponible y movimientos vinculados protegidos contra borrado manual.
- [x] Compras pendientes y costos pendientes — separados para evitar completar CMV sin registrar la salida real de Caja.
- [x] Edición/eliminación de pedidos e ítems — bloqueadas operaciones que romperían Caja/abonos; precios recalculan subtotal y total.
- [x] WhatsApp y datos incompletos de clientes — si falta teléfono ahora se muestra Agregar WhatsApp en vez de ocultar la cobranza.

## Fase 4 — Dashboard y métricas
- [x] Asegurar que cada KPI tenga una definición única.
- [x] Alinear períodos de métricas y gráficos — tarjetas son del mes; gráficos se etiquetan explícitamente como últimos 14 días y aclaran que no deben coincidir.
- [x] Verificar Ventas vs Cobros y excluir movimientos no-cliente.
- [ ] Revisar ticket promedio, pedidos, deuda y ganancia.

## Fase 5 — iPhone / Android
- [ ] 320, 360, 375, 390, 412 y 430 px.
- [x] Safe areas — viewport-fit=cover, layout y overlays respetan env(safe-area-inset-*).
- [ ] Teclado móvil.
- [x] Inputs >= 16px — regla transversal móvil evita zoom automático de iOS.
- [x] Touch targets >= 44px — botones móviles tienen mínimo 44px; controles principales de estado 48px.
- [ ] Modales con acciones siempre visibles.
- [~] Sin scroll horizontal — salvaguarda global + shells por ruta aplicados; falta prueba visual final por anchos.
- [x] Bottom nav no tapa contenido — main y shells reservan espacio con safe-area; modales críticos suben sobre la navegación.
- [ ] Tema Clásico y Premium Dark.

## Fase 6 — Calidad de código y despliegue
- [x] CI en cada push a main.
- [x] Lint + TypeScript + build en CI.
- [x] Integrar pruebas financieras al CI.
- [x] Eliminar hacks estructurales y portales DOM frágiles — métricas del Dashboard ahora renderizan directamente en page.tsx y reutilizan los datos ya cargados.
- [~] Revisar warnings y errores antes de cerrar auditoría — lint histórico detectado; TypeScript/tests/build siguen siendo bloqueantes.

## Hallazgos iniciales
1. El CI anterior no corría en pushes directos a main, aunque main es la rama de producción.
2. Existe una suite financiera, pero no está conectada al CI.
3. finance.ts todavía tiene un comentario ambiguo sobre si amount está en pesos o centavos; debe quedar formalizado como centavos.
4. isCustomerPayment actualmente toma cualquier INGRESO no transferencia/no conciliación como pago de cliente; puede inflar gráficos de Cobros si existen otros ingresos.
5. DashboardMetricsPortal inserta métricas buscando nodos por selector CSS y usando createPortal; funciona, pero es una dependencia estructural frágil y debe integrarse directamente al Dashboard.
6. Hay varias capas CSS globales y por ruta; se debe revisar precedencia para evitar regresiones móviles.
7. Clientes oculta el botón de WhatsApp si no hay teléfono, sin explicar por qué; el flujo debe mostrar una acción para completar el dato.

Estado: auditoría en curso. Matemática base corregida y etapa transaccional activa: Nuevo Pedido y Abonos ya usan RPC PostgreSQL atómicas.


### Hallazgos corregidos — edición histórica
- Se eliminó la edición manual destructiva de "Total cobrado" desde la ficha de pedido; los nuevos cobros pasan por el flujo atómico de abonos.
- Ya no se permite bajar el total de un pedido por debajo de lo ya abonado.
- Cambiar precio recalcula también subtotal y total, evitando snapshots incoherentes.
- Costos/cantidades con salida de Caja o compra CONSEGUIDO quedan bloqueados para impedir divergencia entre CMV y Caja.
- Pedidos con movimientos financieros no pueden borrarse directamente.


### Hallazgos corregidos — Compras y costos
- Costos Pendientes podía mostrar también prendas del flujo actual de Compras Pendientes. Eso permitía completar un costo histórico sin registrar simultáneamente la salida de Caja.
- Ahora todo ítem enlazado a pending_purchases se excluye de Costos Pendientes y debe resolverse desde Compras Pendientes.
- El guardado de costos históricos escribe wholesaleCost (snapshot canónico) además de costCents por compatibilidad.
- Se eliminó una sugerencia hardcodeada específica de "Baggi Bordo" y $13.990, porque podía introducir un costo incorrecto.
- Marcar una compra como NO DISPONIBLE aclara que no cambia automáticamente el total ni la deuda de la clienta.
- El lint encontró deuda técnica histórica en muchas pantallas; se mantiene visible pero temporalmente no bloqueante mientras TypeScript, pruebas financieras y build sí bloquean.


### Hallazgos corregidos — Finanzas y clientes
- Finanzas ya no permite borrar desde la UI movimientos asociados a pedidos ni una sola mitad de una transferencia.
- Mover Plata valida monto > 0 y no permite mover más que el saldo registrado en la cuenta origen.
- Los egresos manuales validan monto positivo antes de insertar.
- Clientes con historial de pedidos/ventas ya no pueden eliminarse desde la UI, evitando destruir referencias históricas.
- Clientes sin teléfono muestran "Sin WhatsApp" y, si tienen deuda, un botón "Agregar WhatsApp".
- El Dashboard tipó correctamente order_id en transacciones; la clasificación de Cobros puede usar el vínculo real al pedido.


### Hallazgos corregidos — seguimiento de pedidos
- La lista de Pedidos abría la ficha del cliente en vez de la ficha del pedido; ahora navega a /pedidos/[id].
- Pedidos CANCELADO/ANULADO ya no contaminan las pestañas Pendientes o Completados; siguen visibles en Todos como historial.
- Estado financiero en el listado usa calculateOrderBalance/isValidSale, no una comparación paralela.
- Fechas de Pedidos se muestran explícitamente con timezone Argentina y no dependen del huso horario configurado en el teléfono.
- Los controles principales de estado tienen objetivo táctil mínimo de 48 px para iPhone/Android.


### Auditoría móvil transversal
- Se agregó fallback 100vh + 100dvh para Safari/iOS y WebView Android.
- Inputs móviles permanecen en 16px para evitar zoom al enfocar en iPhone.
- Botones móviles tienen objetivo táctil mínimo de 44px; icon-only con title/aria-label también ancho mínimo.
- El navegador cambia theme-color según Clásico/Premium Dark para integrar mejor barra superior/PWA.
- Sigue pendiente la verificación visual final en 320/360/375/390/412/430 px; el código ya tiene las salvaguardas base.


### Refactor estructural — Dashboard
- Se eliminó DashboardMetricsPortal, createPortal, MutationObserver y la búsqueda de nodos por selectores CSS.
- Las métricas se renderizan directamente después del saludo en el árbol React.
- El componente reutiliza orders/transactions/productsMap ya cargados por el Dashboard; se eliminaron consultas Supabase duplicadas.
- Se removieron reglas CSS de order usadas únicamente para forzar la posición del portal.


### Hallazgo corregido — saldos iniciales
- Un saldo/ingreso inicial sigue formando parte de Caja, pero ya no se interpreta como Cobro de clientes.
- Las tarjetas Ingresos/Egresos de Finanzas excluyen transferencias internas, conciliaciones y saldos iniciales para mostrar actividad real y no movimientos de configuración.


### Compras Pendientes — hardening activado
- La migración 20260926_harden_pending_purchases.sql ya fue aplicada en Supabase.
- Marcar una compra como CONSEGUIDO actualiza snapshot histórico + pending_purchases + salida de Caja dentro de una sola transacción.
- Asignar/cambiar proveedor ahora usa assign_pending_purchase_supplier_atomic y mantiene pedido + compra pendiente sincronizados.
- El frontend dejó de crear/buscar proveedor y actualizar pending_purchases en pasos separados.
