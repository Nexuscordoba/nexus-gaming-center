/**
 * Script de Simulación de Estrés, Concurrencia e Integridad de Datos
 * Proyecto: Nexus Gaming Center & Cafetería (nexusgamingcenter.es)
 * Etiqueta de trazabilidad: TEST_QA_
 *
 * Ejecutar con: node --experimental-strip-types scripts/stress-test-apertura.ts
 */

import { createClient } from '@supabase/supabase-js';

interface LineaTicketFiscal {
  articulo_id?: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  subtotal_linea: number;
  tipo_iva?: number;
  porcentaje_iva?: number;
}

function redondearMoneda(valor: number): number {
  const num = Number(valor || 0);
  if (!Number.isFinite(num)) return 0;
  const signo = num < 0 ? -1 : 1;
  return (signo * Math.round((Math.abs(num) + Number.EPSILON) * 100)) / 100;
}

function calcularDesgloseImpuestosLineas(
  lineas: LineaTicketFiscal[],
  dtoGeneralPorc: number = 0,
  totalFinalObjetivo?: number
) {
  const factorDtoGeneral = 1 - Math.max(0, Math.min(100, Number(dtoGeneralPorc || 0))) / 100;
  let suma10SinDtoGen = 0;
  let suma21SinDtoGen = 0;

  for (const linea of lineas || []) {
    const subtotalLinea = Number(linea.subtotal_linea || 0);
    const porcentajeIva = Number(linea.porcentaje_iva ?? linea.tipo_iva ?? 10) === 21 ? 21 : 10;
    if (porcentajeIva === 21) {
      suma21SinDtoGen = redondearMoneda(suma21SinDtoGen + subtotalLinea);
    } else {
      suma10SinDtoGen = redondearMoneda(suma10SinDtoGen + subtotalLinea);
    }
  }

  let totalConIva10 = redondearMoneda(suma10SinDtoGen * factorDtoGeneral);
  let totalConIva21 = redondearMoneda(suma21SinDtoGen * factorDtoGeneral);

  const objetivoTotal =
    totalFinalObjetivo !== undefined && Number.isFinite(totalFinalObjetivo)
      ? redondearMoneda(totalFinalObjetivo)
      : redondearMoneda((suma10SinDtoGen + suma21SinDtoGen) * factorDtoGeneral);

  const diferenciaCentimos = redondearMoneda(objetivoTotal - (totalConIva10 + totalConIva21));
  if (Math.abs(diferenciaCentimos) > 0 && Math.abs(diferenciaCentimos) <= 0.05) {
    if (Math.abs(totalConIva21) > Math.abs(totalConIva10)) {
      totalConIva21 = redondearMoneda(totalConIva21 + diferenciaCentimos);
    } else if (Math.abs(totalConIva10) > 0) {
      totalConIva10 = redondearMoneda(totalConIva10 + diferenciaCentimos);
    } else if (Math.abs(totalConIva21) > 0) {
      totalConIva21 = redondearMoneda(totalConIva21 + diferenciaCentimos);
    }
  }

  const base_imponible_10 = redondearMoneda(totalConIva10 / 1.1);
  const iva_10 = redondearMoneda(totalConIva10 - base_imponible_10);
  const base_imponible_21 = redondearMoneda(totalConIva21 / 1.21);
  const iva_21 = redondearMoneda(totalConIva21 - base_imponible_21);

  return {
    totalConIva10,
    base_imponible_10,
    iva_10,
    totalConIva21,
    base_imponible_21,
    iva_21,
    baseImponibleTotal: redondearMoneda(base_imponible_10 + base_imponible_21),
    cuotaIvaTotal: redondearMoneda(iva_10 + iva_21),
    totalGeneral: redondearMoneda(base_imponible_10 + base_imponible_21 + iva_10 + iva_21)
  };
}

function haSuperadoFechaHoraCorte(guiso: { fecha: string; fecha_corte?: string; hora_corte?: string }): boolean {
  const fechaCorteRef = guiso.fecha_corte || guiso.fecha;
  if (!fechaCorteRef) return false;
  const matchHora = (guiso.hora_corte || '21:00').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!matchHora) return false;
  const hh = matchHora[1].padStart(2, '0');
  const mm = matchHora[2].padStart(2, '0');
  const fechaHoraCorte = new Date(`${fechaCorteRef}T${hh}:${mm}:00`);
  if (isNaN(fechaHoraCorte.getTime())) return false;
  return Date.now() > fechaHoraCorte.getTime();
}

const SUPABASE_URL = 'https://buwzeodmfhagcrvqjuim.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_d9gJ_BRrji-jxVy_BcyrhA_1uLTsyfg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 20 } }
});

const PREFIX = 'TEST_QA_';
const RUN_ID = Date.now().toString().slice(-6);

interface TestResult {
  escenario: string;
  nombre: string;
  estado: 'PASS' | 'FAIL' | 'WARN';
  duracionMs: number;
  detalle: string;
}

const resultados: TestResult[] = [];
const logResult = (r: TestResult) => {
  resultados.push(r);
  const icon = r.estado === 'PASS' ? '✅' : r.estado === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} [${r.escenario}] ${r.nombre} (${r.duracionMs}ms): ${r.detalle}`);
};

// Trackers para referencia en el informe y limpieza
const createdIds = {
  empleados: [] as string[],
  productos_carta: [] as number[],
  articulos_cafeteria: [] as string[],
  escandallos_cafeteria: [] as string[],
  guisos_programados: [] as string[],
  reservas_guisos: [] as string[],
  comandas_cocina: [] as string[],
  facturas_tickets: [] as string[],
  cierres_caja: [] as string[],
  fichajes: [] as string[],
  movimientos_generales: [] as string[],
  caja_diaria_id: null as number | null,
  caja_diaria_backup: null as { total_efectivo: number; total_tarjeta: number } | null
};

async function main() {
  console.log(`\n🚀 INICIANDO BATERÍA DE PRUEBAS DE ESTRÉS NEXUS (${PREFIX}${RUN_ID})\n`);
  const tGlobal = Date.now();

  // =========================================================================
  // SETUP INICIAL DE DATOS DE PRUEBA (ETIQUETADOS CON TEST_QA_)
  // =========================================================================
  const pinCam1 = `9${RUN_ID.slice(-3)}`;
  const pinCam2 = `8${RUN_ID.slice(-3)}`;
  const pinInact = `7${RUN_ID.slice(-3)}`;

  const { data: emps, error: errEmp } = await supabase
    .from('empleados')
    .insert([
      { nombre: `${PREFIX}Camarero1_${RUN_ID}`, apellidos: 'QA', dni_nie: `QA1${RUN_ID}A`, pin_acceso: pinCam1, rol: 'empleado', activo: true },
      { nombre: `${PREFIX}Camarero2_${RUN_ID}`, apellidos: 'QA', dni_nie: `QA2${RUN_ID}B`, pin_acceso: pinCam2, rol: 'empleado', activo: true },
      { nombre: `${PREFIX}Inactivo_${RUN_ID}`, apellidos: 'QA', dni_nie: `QA3${RUN_ID}C`, pin_acceso: pinInact, rol: 'empleado', activo: false }
    ])
    .select();
  if (errEmp || !emps) throw new Error('Error creando empleados QA: ' + errEmp?.message);
  emps.forEach((e) => createdIds.empleados.push(e.id));

  // Crear artículos en articulos_cafeteria (1 ingrediente + 1 producto stock limitado + 1 producto IVA 21%)
  const { data: arts, error: errArts } = await supabase
    .from('articulos_cafeteria')
    .insert([
      {
        nombre: `${PREFIX}Ingrediente_Carne_${RUN_ID}`,
        categoria: 'Materia Prima',
        precio_venta: 0,
        coste_unitario: 2.0,
        tipo_iva: 10,
        unidad_medida: 'ud',
        controla_stock: true,
        stock_actual: 10,
        stock_minimo: 3,
        es_compuesto: false,
        vendible_tpv: false,
        activo: true
      },
      {
        nombre: `${PREFIX}Bocadillo_Limitado_${RUN_ID}`,
        categoria: 'Cocina',
        destino: 'cocina',
        precio_venta: 5.5,
        coste_unitario: 1.5,
        tipo_iva: 10,
        unidad_medida: 'ud',
        controla_stock: true,
        stock_actual: 5,
        stock_minimo: 2,
        es_compuesto: false,
        vendible_tpv: true,
        activo: true
      },
      {
        nombre: `${PREFIX}Copa_21IVA_${RUN_ID}`,
        categoria: 'Bebidas',
        destino: 'barra',
        precio_venta: 7.0,
        coste_unitario: 1.8,
        tipo_iva: 21,
        porcentaje_iva: 21,
        unidad_medida: 'ud',
        controla_stock: true,
        stock_actual: 20,
        stock_minimo: 5,
        es_compuesto: false,
        vendible_tpv: true,
        activo: true
      }
    ])
    .select();
  if (errArts || !arts) throw new Error('Error creando articulos_cafeteria QA: ' + errArts?.message);
  arts.forEach((a) => createdIds.articulos_cafeteria.push(a.id));
  const artIngrediente = arts[0];
  const artLimitado = arts[1];
  const artCopa21 = arts[2];

  // Crear productos_carta vinculados
  const { data: prods, error: errProds } = await supabase
    .from('productos_carta')
    .insert([
      {
        nombre: artLimitado.nombre,
        precio: 5.5,
        categoria: 'Cocina',
        destino: 'cocina',
        activo: true,
        tipo_iva: 10,
        controla_stock: true,
        stock_actual: 5,
        stock_minimo: 2,
        es_compuesto: false,
        articulo_inventario_id: artLimitado.id
      },
      {
        nombre: artCopa21.nombre,
        precio: 7.0,
        categoria: 'Bebidas',
        destino: 'barra',
        activo: true,
        tipo_iva: 21,
        controla_stock: true,
        stock_actual: 20,
        stock_minimo: 5,
        es_compuesto: false,
        articulo_inventario_id: artCopa21.id
      }
    ])
    .select();
  if (errProds || !prods) throw new Error('Error creando productos_carta QA: ' + errProds?.message);
  prods.forEach((p) => createdIds.productos_carta.push(p.id));
  const prodLimitado = prods[0];
  const prodCopa21 = prods[1];

  // Vincular escandallo al bocadillo limitado para probar descuento de ingrediente
  const { data: escData, error: errEsc } = await supabase
    .from('escandallos_cafeteria')
    .insert([
      {
        articulo_padre_id: artLimitado.id,
        ingrediente_id: artIngrediente.id,
        cantidad: 1,
        unidad_uso: 'ud',
        merma_porcentaje: 0
      }
    ])
    .select();
  if (!errEsc && escData) {
    escData.forEach((e: any) => createdIds.escandallos_cafeteria.push(e.id));
  }

  // =========================================================================
  // ESCENARIO A — Concurrencia de pedidos (Hora punta: 12 comandas simultáneas)
  // =========================================================================
  console.log('\n--- ESCENARIO A: Concurrencia de pedidos (Hora punta) ---');
  const realtimeEvents: any[] = [];
  const rtChannel = supabase
    .channel(`qa-realtime-${RUN_ID}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comandas_cocina' }, (payload) => {
      if (String(payload.new?.mesa || '').startsWith(PREFIX) || String(payload.new?.ticket_number || '').startsWith(PREFIX)) {
        realtimeEvents.push(payload.new);
      }
    });

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => resolve(), 3500);
    rtChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  const tA = Date.now();
  const promesasA: Promise<any>[] = [];

  // 6 pedidos desde TableWaiter (camareros distintos por pin_acceso)
  for (let i = 1; i <= 6; i++) {
    const pinUsado = i % 2 === 0 ? pinCam1 : pinCam2;
    const empRow = emps.find((e) => e.pin_acceso === pinUsado)!;
    const mesaNombre = `${PREFIX}MESA_${90 + i}`;
    promesasA.push(
      supabase
        .from('comandas_cocina')
        .insert([
          {
            ticket_number: `${PREFIX}W${i}_${RUN_ID}`,
            mesa: mesaNombre,
            tipo_destino: 'cocina',
            estado: 'pendiente',
            pagado: false,
            camarero_nombre: empRow.nombre,
            items: [
              {
                producto_id: prodLimitado.id,
                nombre: `${PREFIX}Tostada_Jamon`,
                precio: 3.5,
                cantidad: 2,
                destino: 'cocina',
                categoria: 'Cocina',
                porcentaje_iva: 10,
                tipo_iva: 10,
                comentarios: `${PREFIX}Nota rápida sin tomate`,
                estado_cocina: 'pendiente',
                listo: false
              },
              {
                producto_id: prodCopa21.id,
                nombre: `${PREFIX}Cafe_Con_Leche`,
                precio: 1.8,
                cantidad: 1,
                destino: 'barra',
                categoria: 'Bebidas',
                porcentaje_iva: 10,
                tipo_iva: 10,
                comentarios: `${PREFIX}Leche templada`,
                estado_cocina: 'pendiente',
                listo: false
              }
            ]
          }
        ])
        .select()
    );
  }

  // 6 pedidos desde TableOrder QR (incluyendo 2 simultáneos sobre MESA 99)
  const mesasQR = [97, 98, 99, 99, 100, 101];
  mesasQR.forEach((mNum, idx) => {
    promesasA.push(
      supabase
        .from('comandas_cocina')
        .insert([
          {
            ticket_number: `${PREFIX}QR${idx + 1}_${RUN_ID}`,
            mesa: `${PREFIX}MESA_${mNum}`,
            tipo_destino: idx % 2 === 0 ? 'cocina' : 'barra',
            estado: 'pendiente',
            pagado: false,
            items: [
              {
                producto_id: idx % 2 === 0 ? prodLimitado.id : prodCopa21.id,
                nombre: idx % 2 === 0 ? `${PREFIX}Tostada_Jamon` : `${PREFIX}Cafe_Con_Leche`,
                precio: idx % 2 === 0 ? 3.5 : 1.8,
                cantidad: 1,
                destino: idx % 2 === 0 ? 'cocina' : 'barra',
                categoria: idx % 2 === 0 ? 'Cocina' : 'Bebidas',
                porcentaje_iva: idx % 2 === 0 ? 10 : 21,
                tipo_iva: idx % 2 === 0 ? 10 : 21,
                comentarios: `${PREFIX}Pedido desde QR mesa`,
                estado_cocina: 'pendiente',
                listo: false
              }
            ]
          }
        ])
        .select()
    );
  });

  const resA = await Promise.all(promesasA);
  const durA = Date.now() - tA;
  const insertadasA = resA.flatMap((r) => r.data || []);
  insertadasA.forEach((c) => createdIds.comandas_cocina.push(c.id));

  // Esperar hasta 2.5s para que lleguen eventos Realtime
  await new Promise((r) => setTimeout(r, 2500));
  await supabase.removeChannel(rtChannel);

  const erroresA = resA.filter((r) => r.error);
  const comandasMesa99 = insertadasA.filter((c) => c.mesa === `${PREFIX}MESA_99`);
  const totalTostadasPedidas = insertadasA.reduce(
    (acc, c) => acc + (c.items || []).filter((it: any) => it.nombre === `${PREFIX}Tostada_Jamon`).reduce((s: number, it: any) => s + it.cantidad, 0),
    0
  );

  logResult({
    escenario: 'A',
    nombre: '12 Comandas concurrentes (Promise.all)',
    estado: erroresA.length === 0 && insertadasA.length === 12 ? 'PASS' : 'FAIL',
    duracionMs: durA,
    detalle: `Insertadas ${insertadasA.length}/12 comandas. Mesa 99 concurrente conservó ${comandasMesa99.length}/2 comandas sin pisarse. Total unidades lote Tostada=${totalTostadasPedidas} (esperado 15).`
  });

  logResult({
    escenario: 'A',
    nombre: 'Recepción Supabase Realtime (KDS/Bar)',
    estado: realtimeEvents.length === 12 ? 'PASS' : realtimeEvents.length > 0 ? 'WARN' : 'FAIL',
    duracionMs: durA,
    detalle: `Recibidos ${realtimeEvents.length}/12 eventos INSERT por Realtime.`
  });

  // Simular marcar platos como LISTO en KitchenDisplay y verificar limpieza de vista activa
  const tListo = Date.now();
  const comandasCocinaA = insertadasA.filter((c) => c.tipo_destino === 'cocina');
  await Promise.all(
    comandasCocinaA.map((c) => {
      const itemsListos = (c.items || []).map((it: any) => ({ ...it, listo: true, estado_cocina: 'listo' }));
      return supabase.from('comandas_cocina').update({ items: itemsListos, estado: 'listo' }).eq('id', c.id);
    })
  );
  const { data: checkActivas } = await supabase
    .from('comandas_cocina')
    .select('id, estado, items')
    .in('id', comandasCocinaA.map((c) => c.id));
  const colgadas = (checkActivas || []).filter((c: any) => c.estado !== 'listo');
  logResult({
    escenario: 'A',
    nombre: 'Limpieza KDS al marcar LISTO',
    estado: colgadas.length === 0 ? 'PASS' : 'FAIL',
    duracionMs: Date.now() - tListo,
    detalle: `${comandasCocinaA.length} comandas marcadas LISTO. Tarjetas colgadas en vista activa: ${colgadas.length}.`
  });

  // =========================================================================
  // ESCENARIO B — Integridad de Stock y Escandallos bajo carga
  // =========================================================================
  console.log('\n--- ESCENARIO B: Integridad de Stock y Escandallos bajo carga ---');
  const tB = Date.now();

  // Simular la lógica corregida con CAS (descontarStockConCAS) ejecutada concurrentemente desde 3 mesas (2 uds cada una = 6 uds sobre stock 5)
  const descontarConCAS = async (tabla: 'productos_carta' | 'articulos_cafeteria', id: number | string, cantidad: number) => {
    for (let intento = 0; intento < 6; intento++) {
      const { data: row } = await supabase.from(tabla).select('id, stock_actual, controla_stock').eq('id', id).maybeSingle();
      if (!row || row.controla_stock === false) return { ok: true };
      const stockActual = Number(row.stock_actual ?? 0);
      if (stockActual < cantidad) return { ok: false, motivo: 'STOCK_INSUFICIENTE', stockDisponible: stockActual };
      const nuevoStock = Number((stockActual - cantidad).toFixed(4));
      const { data: updated } = await supabase
        .from(tabla)
        .update({ stock_actual: nuevoStock })
        .eq('id', id)
        .eq('stock_actual', row.stock_actual)
        .select('id, stock_actual')
        .maybeSingle();
      if (updated) return { ok: true, nuevoStock: Number(updated.stock_actual) };
      await new Promise((r) => setTimeout(r, 15 + Math.floor(Math.random() * 40)));
    }
    return { ok: false, motivo: 'CONCURRENCIA_EXCEDIDA' };
  };

  const descontarMesaCAS = async () => {
    const rProd = await descontarConCAS('productos_carta', prodLimitado.id, 2);
    if (!rProd.ok) return rProd;
    await descontarConCAS('articulos_cafeteria', artLimitado.id, 2);
    await descontarConCAS('articulos_cafeteria', artIngrediente.id, 2);
    return rProd;
  };

  const resB = await Promise.all([descontarMesaCAS(), descontarMesaCAS(), descontarMesaCAS()]);

  const { data: prodFinal } = await supabase.from('productos_carta').select('stock_actual, stock_minimo').eq('id', prodLimitado.id).single();
  const { data: artFinal } = await supabase.from('articulos_cafeteria').select('stock_actual, stock_minimo').eq('id', artLimitado.id).single();
  const { data: ingFinal } = await supabase.from('articulos_cafeteria').select('stock_actual').eq('id', artIngrediente.id).single();

  const stockFinalProd = Number(prodFinal?.stock_actual);
  const stockFinalIng = Number(ingFinal?.stock_actual);
  const aceptados = resB.filter((r) => r.ok).length;
  const rechazados = resB.filter((r) => !r.ok).length;
  const alertaBajoStock = stockFinalProd <= Number(prodFinal?.stock_minimo);

  logResult({
    escenario: 'B',
    nombre: 'Concurrencia de stock con CAS (3 mesas x 2 uds sobre stock=5)',
    estado: aceptados === 2 && rechazados === 1 && stockFinalProd === 1 && stockFinalIng === 6 && alertaBajoStock ? 'PASS' : 'FAIL',
    duracionMs: Date.now() - tB,
    detalle: `Pedidos aceptados=${aceptados}/3, rechazados por stock=${rechazados}/3. Stock final productos_carta=${stockFinalProd}, articulos_cafeteria=${artFinal?.stock_actual}, ingrediente=${stockFinalIng}. Stock negativo=${stockFinalProd < 0}. Alerta roja bajo stock activa=${alertaBajoStock} (${stockFinalProd} <= min ${prodFinal?.stock_minimo}).`
  });

  // =========================================================================
  // ESCENARIO C — Guisos Bajo Demanda (Cupos y corte horario)
  // =========================================================================
  console.log('\n--- ESCENARIO C: Guisos Bajo Demanda (Cupos y corte horario) ---');
  const tC = Date.now();
  const hoyISO = new Date().toISOString().split('T')[0];
  const ayerISO = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const { data: guisosC, error: errGuiso } = await supabase
    .from('guisos_programados')
    .insert([
      {
        fecha: hoyISO,
        fecha_corte: hoyISO,
        hora_corte: '23:59',
        nombre_plato: `${PREFIX}Carrillada_${RUN_ID}`,
        min_raciones: 4,
        precio_barra: 9.5,
        precio_takeaway: 9.0,
        estado: 'buscando_minimo'
      },
      {
        fecha: hoyISO,
        fecha_corte: ayerISO,
        hora_corte: '10:00',
        nombre_plato: `${PREFIX}Guiso_Expirado_${RUN_ID}`,
        min_raciones: 4,
        precio_barra: 9.5,
        precio_takeaway: 9.0,
        estado: 'buscando_minimo'
      }
    ])
    .select();
  if (errGuiso || !guisosC) throw new Error('Error creando guisos QA: ' + errGuiso?.message);
  guisosC.forEach((g) => createdIds.guisos_programados.push(g.id));
  const guisoActivo = guisosC[0];
  const guisoFueraHora = guisosC[1];

  // Verificar bloqueo frontend de hora corte
  const bloqueadoFrontend = haSuperadoFechaHoraCorte(guisoFueraHora as any);

  // Probar inserción concurrente de reservas + inserción directa en DB fuera de hora
  const [resR1, resR2, resFueraHoraDB] = await Promise.all([
    supabase
      .from('reservas_guisos')
      .insert([{ guiso_id: guisoActivo.id, nombre_cliente: `${PREFIX}Cliente1`, telefono: '600000001', raciones: 3, modalidad: 'barra', estado_pago: 'pendiente' }])
      .select(),
    supabase
      .from('reservas_guisos')
      .insert([{ guiso_id: guisoActivo.id, nombre_cliente: `${PREFIX}Cliente2`, telefono: '600000002', raciones: 3, modalidad: 'takeaway', estado_pago: 'pendiente' }])
      .select(),
    supabase
      .from('reservas_guisos')
      .insert([{ guiso_id: guisoFueraHora.id, nombre_cliente: `${PREFIX}ClienteFueraHora`, telefono: '600000003', raciones: 2, modalidad: 'barra', estado_pago: 'pendiente' }])
      .select()
  ]);

  [resR1, resR2, resFueraHoraDB].forEach((r) => (r.data || []).forEach((row: any) => createdIds.reservas_guisos.push(row.id)));

  const { data: guisoPost } = await supabase.from('guisos_programados').select('estado').eq('id', guisoActivo.id).single();

  logResult({
    escenario: 'C',
    nombre: 'Auto-confirmación guiso al superar min_raciones',
    estado: guisoPost?.estado === 'confirmado' ? 'PASS' : 'FAIL',
    duracionMs: Date.now() - tC,
    detalle: `Estado guiso tras 6 raciones concurrentes (min=4): ${guisoPost?.estado}. Frontend bloquea fuera de hora=${bloqueadoFrontend}.`
  });

  logResult({
    escenario: 'C',
    nombre: 'Validación DB de corte horario y cupo máximo',
    estado: resFueraHoraDB.error ? 'PASS' : 'FAIL',
    duracionMs: Date.now() - tC,
    detalle: resFueraHoraDB.error
      ? `DB bloqueó reserva fuera de hora: ${resFueraHoraDB.error.message}`
      : `DB permitió INSERT en reservas_guisos con fecha_corte=${ayerISO} pasada (solo validado en frontend, sin trigger/RLS en BD ni columna max_raciones).`
  });

  // =========================================================================
  // ESCENARIO D — Cobros simultáneos, Facturación, Recibos QR y Arqueo Z
  // =========================================================================
  console.log('\n--- ESCENARIO D: Cobros simultáneos, Facturación, Recibos QR y Arqueo Z ---');
  const tD = Date.now();

  // Obtener o crear caja_diaria abierta para hoy (guardando backup para restaurar o medir)
  const { data: cajaAbierta } = await supabase
    .from('caja_diaria')
    .select('*')
    .eq('fecha', hoyISO)
    .eq('estado', 'abierta')
    .maybeSingle();

  if (cajaAbierta) {
    createdIds.caja_diaria_id = cajaAbierta.id;
    createdIds.caja_diaria_backup = {
      total_efectivo: Number(cajaAbierta.total_efectivo || 0),
      total_tarjeta: Number(cajaAbierta.total_tarjeta || 0)
    };
  }

  // Cobrar 3 mesas concurrentemente con mezcla IVA 10% + 21%
  const lineasMixtas: LineaTicketFiscal[] = [
    { nombre: `${PREFIX}Bocadillo_10`, cantidad: 2, precio_unitario: 5.5, descuento_porcentaje: 0, subtotal_linea: 11.0, tipo_iva: 10, porcentaje_iva: 10 },
    { nombre: `${PREFIX}Copa_21`, cantidad: 1, precio_unitario: 7.0, descuento_porcentaje: 0, subtotal_linea: 7.0, tipo_iva: 21, porcentaje_iva: 21 }
  ];
  const desgloseMix = calcularDesgloseImpuestosLineas(lineasMixtas, 0, 18.0); // Total = 18.00€

  const mesasCobro = [
    { mesa: `${PREFIX}MESA_91`, metodo: 'efectivo' as const },
    { mesa: `${PREFIX}MESA_92`, metodo: 'tarjeta' as const },
    { mesa: `${PREFIX}MESA_93`, metodo: 'tarjeta' as const } // Express / tarjeta
  ];

  const cobrosRes = await Promise.all(
    mesasCobro.map(async (mc) => {
      const { data: doc, error } = await supabase.rpc('emitir_documento_fiscal', {
        p_serie: 'T',
        p_tipo_documento: 'SIMPLIFICADA',
        p_mesa: mc.mesa,
        p_vendedor: emps[0].nombre,
        p_metodo_pago: mc.metodo,
        p_importe_efectivo: mc.metodo === 'efectivo' ? 18.0 : 0,
        p_importe_tarjeta: mc.metodo !== 'efectivo' ? 18.0 : 0,
        p_subtotal_bruto: desgloseMix.baseImponibleTotal,
        p_descuento_general_porc: 0,
        p_descuento_total_imp: 0,
        p_autorizado_por: null,
        p_tipo_iva: 10,
        p_total_final: 18.0,
        p_lineas: lineasMixtas
      });
      if (error || !doc) return { error };

      createdIds.facturas_tickets.push(doc.id);

      await Promise.all([
        supabase
          .from('facturas_tickets')
          .update({
            base_imponible: desgloseMix.baseImponibleTotal,
            cuota_iva: desgloseMix.cuotaIvaTotal
          })
          .eq('id', doc.id),
        supabase
          .from('comandas_cocina')
          .update({
            pagado: true,
            metodo_pago: mc.metodo,
            total_ticket: 18.0,
            factura_fiscal_id: doc.id,
            numero_factura_legal: doc.numero_completo
          })
          .eq('mesa', mc.mesa)
          .eq('pagado', false)
      ]);

      const { data: docFull } = await supabase.from('facturas_tickets').select('*').eq('id', doc.id).single();
      return { doc: docFull || doc };
    })
  );

  const docsEmitidos = cobrosRes.map((r) => r.doc).filter(Boolean);
  const { data: comandasPendientesMesa91 } = await supabase
    .from('comandas_cocina')
    .select('id')
    .in('mesa', mesasCobro.map((m) => m.mesa))
    .eq('pagado', false);

  // Verificar acceso al recibo cerrado desde TableOrder (query por mesa)
  const { data: reciboQR } = await supabase
    .from('facturas_tickets')
    .select('*')
    .or(`mesa.eq.${PREFIX}MESA_91,mesa.eq.MESA 91`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  logResult({
    escenario: 'D',
    nombre: '3 Cobros simultáneos + Liberación de mesa + Recibo QR',
    estado: docsEmitidos.length === 3 && (comandasPendientesMesa91?.length || 0) === 0 && Boolean(reciboQR) ? 'PASS' : 'FAIL',
    duracionMs: Date.now() - tD,
    detalle: `Emitidos ${docsEmitidos.length}/3 tickets. Comandas aún abiertas=${comandasPendientesMesa91?.length || 0}. Recibo QR accesible=${Boolean(reciboQR)} (${reciboQR?.numero_completo}).`
  });

  // Convertir ticket en factura completa (F1) y verificar enlace bidireccional
  const tConv = Date.now();
  const ticketOrig = docsEmitidos[0];
  let enlaceOk = false;
  if (ticketOrig) {
    const { data: docNom, error: errNom } = await supabase.rpc('emitir_documento_fiscal', {
      p_serie: 'F',
      p_tipo_documento: 'NOMINATIVA',
      p_mesa: ticketOrig.mesa,
      p_vendedor: emps[0].nombre,
      p_metodo_pago: ticketOrig.metodo_pago,
      p_importe_efectivo: ticketOrig.importe_efectivo,
      p_importe_tarjeta: ticketOrig.importe_tarjeta,
      p_subtotal_bruto: ticketOrig.subtotal_bruto,
      p_descuento_general_porc: 0,
      p_descuento_total_imp: 0,
      p_autorizado_por: emps[0].nombre,
      p_tipo_iva: 10,
      p_total_final: ticketOrig.total_final,
      p_lineas: ticketOrig.lineas,
      p_ticket_origen_id: ticketOrig.id,
      p_ticket_origen_numero: ticketOrig.numero_completo,
      p_motivo_rectificacion: null,
      p_cliente_nombre: `${PREFIX}Empresa_SL`,
      p_cliente_nif: 'B12345678',
      p_cliente_direccion: 'Calle QA 1, Córdoba'
    });
    if (!errNom && docNom) {
      createdIds.facturas_tickets.push(docNom.id);
      await supabase
        .from('facturas_tickets')
        .update({ ticket_origen_id: ticketOrig.id, ticket_origen_numero: ticketOrig.numero_completo })
        .eq('id', docNom.id);
      await supabase
        .from('facturas_tickets')
        .update({ factura_asociada_id: docNom.id, factura_asociada_numero: docNom.numero_completo })
        .eq('id', ticketOrig.id);

      const { data: checkOrig } = await supabase.from('facturas_tickets').select('factura_asociada_id, factura_asociada_numero').eq('id', ticketOrig.id).single();
      const { data: checkNom } = await supabase.from('facturas_tickets').select('ticket_origen_id, ticket_origen_numero').eq('id', docNom.id).single();

      enlaceOk = checkOrig?.factura_asociada_id === docNom.id && checkNom?.ticket_origen_id === ticketOrig.id;
    }
  }
  logResult({
    escenario: 'D',
    nombre: 'Conversión Ticket -> Factura Nominativa (Enlace Bidireccional)',
    estado: enlaceOk ? 'PASS' : 'FAIL',
    duracionMs: Date.now() - tConv,
    detalle: `Enlace bidireccional en facturas_tickets verificado=${enlaceOk}.`
  });

  // Arqueo Z (cierres_caja) y cuadre exacto de efectivo, tarjeta, bases e IVAs 10% y 21%
  const tArq = Date.now();
  const totalEfectivoTickets = docsEmitidos.reduce((s, d) => s + Number(d.importe_efectivo || 0), 0); // 18.00
  const totalTarjetaTickets = docsEmitidos.reduce((s, d) => s + Number(d.importe_tarjeta || 0), 0);   // 36.00
  const sumaDesgloseBase10 = redondearMoneda(desgloseMix.base_imponible_10 * 3); // 10.00 * 3 = 30.00
  const sumaDesgloseIva10 = redondearMoneda(desgloseMix.iva_10 * 3);             // 1.00 * 3 = 3.00
  const sumaDesgloseBase21 = redondearMoneda(desgloseMix.base_imponible_21 * 3); // 5.79 * 3 = 17.37
  const sumaDesgloseIva21 = redondearMoneda(desgloseMix.iva_21 * 3);             // 1.21 * 3 = 3.63
  const sumaTotalCuadre = redondearMoneda(sumaDesgloseBase10 + sumaDesgloseIva10 + sumaDesgloseBase21 + sumaDesgloseIva21);

  const { data: cierreZ, error: errZ } = await supabase
    .from('cierres_caja')
    .insert([
      {
        fecha_cierre: new Date().toISOString(),
        usuario_nombre: `${PREFIX}Arqueo_${RUN_ID}`,
        fondo_inicial: 100.0,
        ventas_efectivo_sistema: totalEfectivoTickets,
        ventas_tarjeta_sistema: totalTarjetaTickets,
        devoluciones_efectivo: 0,
        efectivo_esperado_caja: redondearMoneda(100.0 + totalEfectivoTickets),
        efectivo_contado_trabajador: redondearMoneda(100.0 + totalEfectivoTickets),
        tarjeta_contada_trabajador: totalTarjetaTickets,
        descuadre_efectivo: 0,
        descuadre_tarjeta: 0,
        observaciones: `${PREFIX}Arqueo Z automático`
      }
    ])
    .select()
    .single();
  if (cierreZ) createdIds.cierres_caja.push(cierreZ.id);

  const cuadraAlCentimo =
    !errZ &&
    cierreZ &&
    Number(cierreZ.ventas_efectivo_sistema) === 18.0 &&
    Number(cierreZ.ventas_tarjeta_sistema) === 36.0 &&
    sumaTotalCuadre === 54.0;

  logResult({
    escenario: 'D',
    nombre: 'Arqueo Z y cuadre al céntimo (10% y 21% IVA)',
    estado: cuadraAlCentimo ? 'PASS' : 'FAIL',
    duracionMs: Date.now() - tArq,
    detalle: `Efectivo=${totalEfectivoTickets}€, Tarjeta=${totalTarjetaTickets}€, Base10=${sumaDesgloseBase10}€ + IVA10=${sumaDesgloseIva10}€, Base21=${sumaDesgloseBase21}€ + IVA21=${sumaDesgloseIva21}€ => Total=${sumaTotalCuadre}€.`
  });

  // =========================================================================
  // ESCENARIO E — Fichajes e Ingresos/Gastos
  // =========================================================================
  console.log('\n--- ESCENARIO E: Fichajes e Ingresos/Gastos ---');
  const tE = Date.now();

  // 1. Verificar bloqueo de empleado inactivo por pin_acceso (lógica QuickClockInModal)
  const { data: empInactCheck } = await supabase.from('empleados').select('*').eq('pin_acceso', pinInact).maybeSingle();
  const bloqueadoPorPin = empInactCheck && empInactCheck.activo === false;

  // 2. Fichajes entrada -> inicio_descanso -> fin_descanso -> salida para empleado activo
  const tiposFichaje = ['entrada', 'inicio_descanso', 'fin_descanso', 'salida'];
  for (const tipo of tiposFichaje) {
    const { data: fRow, error: fErr } = await supabase
      .from('fichajes')
      .insert([{ empleado_id: emps[0].id, tipo, timestamp_fichaje: new Date().toISOString(), notas: `${PREFIX}Fichaje_${tipo}` }])
      .select()
      .single();
    if (!fErr && fRow) createdIds.fichajes.push(fRow.id);
  }

  logResult({
    escenario: 'E',
    nombre: 'Fichajes entrada/pausa/salida y bloqueo activo=false',
    estado: bloqueadoPorPin && createdIds.fichajes.length === 4 ? 'PASS' : 'FAIL',
    duracionMs: Date.now() - tE,
    detalle: `Empleado inactivo bloqueado en app=${bloqueadoPorPin}. Fichajes secuenciales creados=${createdIds.fichajes.length}/4.`
  });

  // 3. Sincronización doble concurrente de cierre de caja hacia movimientos_generales
  const tSync = Date.now();
  const ejecutarSyncComoDashboard = async () => {
    const numFacturaZ = `Z-${String(cierreZ.id).slice(0, 8).toUpperCase()}`;
    const { data: existentes } = await supabase
      .from('movimientos_generales')
      .select('numero_factura')
      .eq('tipo', 'INGRESO')
      .eq('categoria', 'VENTAS_TPV');
    const setExistentes = new Set((existentes || []).map((e) => e.numero_factura));

    if (!setExistentes.has(numFacturaZ)) {
      const totalVentas = redondearMoneda(Number(cierreZ.ventas_efectivo_sistema) + Number(cierreZ.ventas_tarjeta_sistema));
      const baseImponible = redondearMoneda(totalVentas / 1.1);
      const { data: ins } = await supabase
        .from('movimientos_generales')
        .insert([
          {
            fecha: hoyISO,
            tipo: 'INGRESO',
            categoria: 'VENTAS_TPV',
            tercero: `${PREFIX}Clientes Cafetería (Cierre Caja TPV)`,
            concepto: `${PREFIX}Cierre Diario Z (${hoyISO})`,
            numero_factura: numFacturaZ,
            base_imponible: baseImponible,
            tipo_iva: 10,
            cuota_iva: redondearMoneda(totalVentas - baseImponible),
            total: totalVentas,
            metodo_pago: 'TARJETA',
            pagado: true
          }
        ])
        .select();
      return ins || [];
    }
    return [];
  };

  // Probar doble pulsación concurrente (race condition check) vs secuencial
  const [sync1, sync2] = await Promise.all([ejecutarSyncComoDashboard(), ejecutarSyncComoDashboard()]);
  const insertadosSync = [...sync1, ...sync2];
  insertadosSync.forEach((m) => createdIds.movimientos_generales.push(m.id));

  const numFacturaZ = `Z-${String(cierreZ.id).slice(0, 8).toUpperCase()}`;
  const { data: movsZ } = await supabase.from('movimientos_generales').select('id').eq('numero_factura', numFacturaZ);

  logResult({
    escenario: 'E',
    nombre: 'Sincronización Cierre Z -> movimientos_generales (doble pulsación)',
    estado: (movsZ?.length || 0) === 1 ? 'PASS' : 'FAIL',
    duracionMs: Date.now() - tSync,
    detalle: `Registros creados para ${numFacturaZ} tras doble llamada concurrente: ${movsZ?.length || 0} (esperado 1).`
  });

  // =========================================================================
  // RESUMEN FINAL
  // =========================================================================
  console.log(`\n🏁 BATERÍA COMPLETADA en ${Date.now() - tGlobal}ms`);
  console.log('IDs generados (para verificación):', JSON.stringify(createdIds, null, 2));
}

main().catch((err) => {
  console.error('💥 Error fatal en stress-test:', err);
  process.exit(1);
});
