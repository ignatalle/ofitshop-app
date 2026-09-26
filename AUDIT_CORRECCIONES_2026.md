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
- [ ] Auditar ventas, CMV, comisiones, gastos operativos, caja y deuda.
- [x] Auditar pagos parciales, sobrepagos, anulaciones y pedidos cancelados.
- [ ] Revisar clasificación de ingresos para que "Cobros" no incluya ingresos que no sean pagos de clientes.
- [ ] Revisar costos faltantes e histórico de costos.
- [ ] Agregar pruebas para todos los invariantes.

## Fase 2 — Datos y estructura
- [ ] Auditar orders/items, transactions, customers, products, pending_purchases y suppliers.
- [~] Revisar migraciones, triggers y RPC — primera pasada hecha; se agregaron RPC atómicas de pedido y abono.
- [ ] Detectar duplicaciones de lógica entre páginas.
- [ ] Reducir dependencias de textos/descripciones para clasificar movimientos.
- [ ] Revisar RLS/permisos antes de cualquier tienda pública.

## Fase 3 — Flujos funcionales
- [x] Nuevo pedido / Carga rápida — RPC aplicada y frontend conectado de forma atómica.
- [x] Abonos y pagos globales — RPC aplicada y frontend conectado de forma atómica.
- [ ] Cambios de estado y entrega.
- [ ] Gastos, transferencias y retiros.
- [ ] Compras pendientes y costos pendientes.
- [ ] Edición/eliminación de pedidos e ítems.
- [ ] WhatsApp y datos incompletos de clientes.

## Fase 4 — Dashboard y métricas
- [x] Asegurar que cada KPI tenga una definición única.
- [ ] Alinear períodos de métricas y gráficos.
- [x] Verificar Ventas vs Cobros y excluir movimientos no-cliente.
- [ ] Revisar ticket promedio, pedidos, deuda y ganancia.

## Fase 5 — iPhone / Android
- [ ] 320, 360, 375, 390, 412 y 430 px.
- [ ] Safe areas.
- [ ] Teclado móvil.
- [ ] Inputs >= 16px.
- [ ] Touch targets >= 44px.
- [ ] Modales con acciones siempre visibles.
- [ ] Sin scroll horizontal.
- [ ] Bottom nav no tapa contenido.
- [ ] Tema Clásico y Premium Dark.

## Fase 6 — Calidad de código y despliegue
- [x] CI en cada push a main.
- [x] Lint + TypeScript + build en CI.
- [x] Integrar pruebas financieras al CI.
- [ ] Eliminar hacks estructurales y portales DOM frágiles.
- [ ] Revisar warnings y errores antes de cerrar auditoría.

## Hallazgos iniciales
1. El CI anterior no corría en pushes directos a main, aunque main es la rama de producción.
2. Existe una suite financiera, pero no está conectada al CI.
3. finance.ts todavía tiene un comentario ambiguo sobre si amount está en pesos o centavos; debe quedar formalizado como centavos.
4. isCustomerPayment actualmente toma cualquier INGRESO no transferencia/no conciliación como pago de cliente; puede inflar gráficos de Cobros si existen otros ingresos.
5. DashboardMetricsPortal inserta métricas buscando nodos por selector CSS y usando createPortal; funciona, pero es una dependencia estructural frágil y debe integrarse directamente al Dashboard.
6. Hay varias capas CSS globales y por ruta; se debe revisar precedencia para evitar regresiones móviles.
7. Clientes oculta el botón de WhatsApp si no hay teléfono, sin explicar por qué; el flujo debe mostrar una acción para completar el dato.

Estado: auditoría en curso. Matemática base corregida y etapa transaccional activa: Nuevo Pedido y Abonos ya usan RPC PostgreSQL atómicas.
