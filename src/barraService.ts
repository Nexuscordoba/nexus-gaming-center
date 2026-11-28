// src/barraService.ts
import { supabase } from './supabase';
import {
  imprimirDocumentoFiscalHTML,
  calcularDesgloseImpuestosLineas,
  calcularHashVeriFactu,
  redondearMoneda,
  type ConfiguracionFiscal,
  type LineaTicketFiscal
} from './fiscalService';
import { actualizarCajaDiariaAtomica } from './concurrencyHelpers';

export interface TicketBarraItem {
  idCarritoUnico?: number;
  producto_id?: number;
  articulo_inventario_id?: string;
  nombre: string;
  precio: number;
  cantidad: number;
  destino?: 'cocina' | 'barra';
  notaExtra?: string;
  tipo_iva?: number;
  porcentaje_iva?: number;
}

export interface TicketBarra {
  id: string;
  numero_ticket: string; // ej. B-01, B-02
  cliente_alias?: string; // ej. "Javier - Cerveza", o anónimo
  items: TicketBarraItem[];
  total: number;
  estado: 'abierto' | 'cobrado' | 'cancelado';
  metodo_pago?: 'efectivo' | 'tarjeta' | 'bizum' | null;
  camarero_nombre?: string;
  factura_fiscal_id?: string | number | null;
  numero_factura_legal?: string | null;
  notas?: string;
  created_at: string;
  updated_at?: string;
}

const LOCAL_STORAGE_KEY = 'nexus_tickets_barra_cache';

// Helper de caché local
function obtenerCacheLocal(): TicketBarra[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Error al leer caché local de tickets_barra:', err);
    return [];
  }
}

function guardarCacheLocal(tickets: TicketBarra[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tickets));
  } catch (err) {
    console.warn('Error al guardar caché local de tickets_barra:', err);
  }
}

/**
 * Genera el siguiente número de ticket correlativo del día para la barra (ej: B-01, B-02, etc.)
 */
export async function generarSiguienteNumeroTicketBarra(): Promise<string> {
  try {
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('tickets_barra')
      .select('numero_ticket')
      .gte('created_at', hoyInicio.toISOString());

    let maxNum = 0;
    if (!error && Array.isArray(data)) {
      data.forEach((r: any) => {
        const match = String(r.numero_ticket || '').match(/B-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
    }

    // Comprobar también tickets en caché local
    const local = obtenerCacheLocal();
    local.forEach((t) => {
      const match = String(t.numero_ticket || '').match(/B-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const siguiente = maxNum + 1;
    return `B-${String(siguiente).padStart(2, '0')}`;
  } catch (err) {
    console.error('Error calculando correlativo de ticket barra, usando timestamp fallback:', err);
    const d = new Date();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `B-${mm}${ss}`;
  }
}

/**
 * Carga todos los tickets de barra abiertos (pendientes de cobro)
 */
export async function cargarTicketsBarraAbiertos(): Promise<TicketBarra[]> {
  try {
    const { data, error } = await supabase
      .from('tickets_barra')
      .select('*')
      .eq('estado', 'abierto')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error al consultar tickets_barra en Supabase:', {
        mensaje: error.message,
        detalles: error.details,
        codigo: error.code
      });
      return obtenerCacheLocal().filter((t) => t.estado === 'abierto');
    }

    if (data) {
      const normalizados: TicketBarra[] = data.map((d: any) => ({
        id: String(d.id),
        numero_ticket: String(d.numero_ticket || 'B-00'),
        cliente_alias: d.cliente_alias || 'Barra',
        items: Array.isArray(d.items) ? d.items : [],
        total: Number(d.total || 0),
        estado: d.estado || 'abierto',
        metodo_pago: d.metodo_pago || null,
        camarero_nombre: d.camarero_nombre || 'Barra',
        factura_fiscal_id: d.factura_fiscal_id || null,
        numero_factura_legal: d.numero_factura_legal || null,
        notas: d.notas || '',
        created_at: d.created_at || new Date().toISOString(),
        updated_at: d.updated_at || d.created_at
      }));

      guardarCacheLocal(normalizados);
      return normalizados;
    }

    return [];
  } catch (err) {
    console.error('❌ Excepción al cargar tickets_barra abiertos:', err);
    return obtenerCacheLocal().filter((t) => t.estado === 'abierto');
  }
}

/**
 * Crea un nuevo ticket de barra abierto
 */
export async function crearTicketBarra(params: {
  numero_ticket?: string;
  cliente_alias?: string;
  items: TicketBarraItem[];
  total: number;
  camarero_nombre?: string;
  metodo_pago?: 'efectivo' | 'tarjeta' | 'bizum' | null;
}): Promise<TicketBarra> {
  // Asegurar que el número de ticket no sea vacío (campo NOT NULL en DB)
  let numeroFinal = (params.numero_ticket || '').trim();
  if (!numeroFinal) {
    numeroFinal = await generarSiguienteNumeroTicketBarra();
  }
  if (!numeroFinal) {
    const d = new Date();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    numeroFinal = `B-${mm}${ss}`;
  }

  const aliasFinal = (params.cliente_alias || '').trim() || 'Barra';
  const totalFinal = redondearMoneda(params.total);
  const itemsFinal = Array.isArray(params.items) ? params.items : [];
  const camareroFinal = (params.camarero_nombre || '').trim() || 'Barra';
  const estadoFinal = 'abierto';
  const metodoPagoFinal = params.metodo_pago || null;

  // No enviamos 'id' para que Postgres use siempre su valor por defecto 'gen_random_uuid()'
  // Y enviamos únicamente las columnas exactas de la tabla:
  // numero_ticket, cliente_alias, items, total, estado, metodo_pago
  const insertPayload = {
    numero_ticket: numeroFinal,
    cliente_alias: aliasFinal,
    items: itemsFinal,
    total: totalFinal,
    estado: estadoFinal,
    metodo_pago: metodoPagoFinal
  };

  console.log('🍺 [crearTicketBarra] Insertando en tickets_barra de Supabase:', insertPayload);

  const { data, error } = await supabase
    .from('tickets_barra')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    console.error('❌ Error de Supabase al insertar en tickets_barra:', {
      mensaje: error.message,
      detalles: error.details,
      pista: error.hint,
      codigo: error.code,
      payload: insertPayload
    });
    throw new Error(`[Supabase ${error.code || 'ERR'}]: ${error.message}${error.details ? ` (${error.details})` : ''}`);
  }

  if (!data) {
    console.error('❌ Supabase no devolvió la fila insertada.');
    throw new Error('Supabase no devolvió los datos del ticket insertado.');
  }

  const nuevoTicket: TicketBarra = {
    id: String(data.id),
    numero_ticket: data.numero_ticket || numeroFinal,
    cliente_alias: data.cliente_alias || aliasFinal,
    items: Array.isArray(data.items) ? data.items : itemsFinal,
    total: Number(data.total !== undefined ? data.total : totalFinal),
    estado: data.estado || estadoFinal,
    metodo_pago: data.metodo_pago || metodoPagoFinal,
    camarero_nombre: camareroFinal,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || data.created_at || new Date().toISOString()
  };

  // Guardar en caché local
  const cache = obtenerCacheLocal().filter((t) => t.id !== nuevoTicket.id);
  guardarCacheLocal([nuevoTicket, ...cache]);

  // Si contiene artículos cuyo destino es cocina (ej. tapas calientes),
  // enviamos comanda a cocina para que la preparen, identificando claramente que es de barra
  const itemsCocina = itemsFinal.filter((i) => i.destino === 'cocina');
  if (itemsCocina.length > 0) {
    try {
      await supabase.from('comandas_cocina').insert([
        {
          ticket_number: nuevoTicket.numero_ticket,
          mesa: `BARRA (${nuevoTicket.numero_ticket}${nuevoTicket.cliente_alias && nuevoTicket.cliente_alias !== 'Barra' ? ' - ' + nuevoTicket.cliente_alias : ''})`,
          items: itemsCocina.map((ic) => ({
            producto_id: ic.producto_id,
            articulo_inventario_id: ic.articulo_inventario_id,
            nombre: ic.nombre,
            precio: ic.precio,
            cantidad: ic.cantidad,
            destino: 'cocina',
            comentarios: ic.notaExtra || '',
            estado_cocina: 'pendiente'
          })),
          pagado: false,
          tipo_destino: 'cocina',
          camarero_nombre: nuevoTicket.camarero_nombre
        }
      ]);
    } catch (errCocina) {
      console.warn('Aviso: no se pudo enviar comanda de cocina para ticket de barra:', errCocina);
    }
  }

  return nuevoTicket;
}

/**
 * Actualiza los artículos o datos de un ticket de barra existente
 */
export async function actualizarTicketBarra(
  id: string,
  updates: Partial<TicketBarra>
): Promise<boolean> {
  const timestamp = new Date().toISOString();
  // Filtrar estrictamente solo las columnas que existen en la tabla tickets_barra:
  // numero_ticket, cliente_alias, items, total, estado, metodo_pago, updated_at
  const payload: any = { updated_at: timestamp };
  if (updates.numero_ticket !== undefined) payload.numero_ticket = updates.numero_ticket;
  if (updates.cliente_alias !== undefined) payload.cliente_alias = updates.cliente_alias;
  if (updates.items !== undefined) payload.items = updates.items;
  if (updates.total !== undefined) payload.total = redondearMoneda(updates.total);
  if (updates.estado !== undefined) payload.estado = updates.estado;
  if (updates.metodo_pago !== undefined) payload.metodo_pago = updates.metodo_pago;

  console.log(`🍺 [actualizarTicketBarra] Actualizando ticket ${id} en Supabase:`, payload);

  const { error } = await supabase.from('tickets_barra').update(payload).eq('id', id);
  if (error) {
    console.error('❌ Error al actualizar ticket_barra en Supabase:', {
      id,
      payload,
      mensaje: error.message,
      detalles: error.details,
      pista: error.hint,
      codigo: error.code
    });
    throw new Error(`[Supabase ${error.code || 'ERR'}]: ${error.message}${error.details ? ` (${error.details})` : ''}`);
  }

  // Actualizar en caché local tras confirmación de Supabase
  const cache = obtenerCacheLocal();
  const index = cache.findIndex((t) => t.id === id);
  if (index !== -1) {
    cache[index] = { ...cache[index], ...updates, updated_at: timestamp };
    guardarCacheLocal(cache);
  }

  return true;
}

/**
 * Cancela un ticket de barra abierto
 */
export async function cancelarTicketBarra(id: string): Promise<boolean> {
  return actualizarTicketBarra(id, { estado: 'cancelado' });
}

/**
 * Imprime la comanda / pre-ticket térmico de un ticket de barra usando Raw Print / HTML
 */
export function imprimirComandaTicketBarra(
  ticket: TicketBarra,
  configFiscal?: ConfiguracionFiscal | null,
  camareroNombre?: string,
  onComplete?: () => void
) {
  const cfgFallback: ConfiguracionFiscal = {
    razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.',
    nombre_comercial: 'NEXUS',
    nif_cif: 'B00000000',
    direccion_fiscal: 'Polígono Chinales 45, Córdoba',
    telefono: '',
    iva_defecto: 10,
    pin_administrador: '1234'
  };
  const cfg = configFiscal || cfgFallback;

  const lineas: LineaTicketFiscal[] = (ticket.items || []).map((it) => ({
    nombre: it.nombre + (it.notaExtra ? ` [${it.notaExtra}]` : ''),
    cantidad: it.cantidad,
    precio_unitario: it.precio,
    descuento_porcentaje: 0,
    subtotal_linea: redondearMoneda(it.precio * it.cantidad),
    tipo_iva: it.tipo_iva || cfg.iva_defecto || 10,
    porcentaje_iva: it.porcentaje_iva || cfg.iva_defecto || 10
  }));

  const desglose = calcularDesgloseImpuestosLineas(lineas, 0, ticket.total);

  const docPreTicket = {
    serie: 'BARRA',
    tipo_documento: `TICKET COMANDA - ${ticket.numero_ticket}`,
    numero_completo: `${ticket.numero_ticket} (${ticket.cliente_alias || 'BARRA'})`,
    fecha_expedicion: ticket.created_at || new Date().toISOString(),
    mesa: `BARRA ${ticket.cliente_alias ? '· ' + ticket.cliente_alias : ''}`,
    vendedor_nombre: camareroNombre || ticket.camarero_nombre || 'Barra',
    metodo_pago: ticket.metodo_pago ? ticket.metodo_pago.toUpperCase() : 'PENDIENTE',
    subtotal_bruto: desglose.baseImponibleTotal,
    descuento_general_porcentaje: 0,
    descuento_total_importe: 0,
    base_imponible_10: desglose.base_imponible_10,
    iva_10: desglose.iva_10,
    base_imponible_21: desglose.base_imponible_21,
    iva_21: desglose.iva_21,
    base_imponible: desglose.baseImponibleTotal,
    cuota_iva: desglose.cuotaIvaTotal,
    tipo_iva_aplicado: cfg.iva_defecto || 10,
    total_final: ticket.total,
    lineas: lineas,
    hash_actual: 'COMANDA_BARRA_PREVIA'
  };

  imprimirDocumentoFiscalHTML(docPreTicket, cfg, onComplete);
}

/**
 * Cobro independiente de un ticket de barra:
 * - Emite el documento fiscal (Factura Simplificada VeriFactu)
 * - Actualiza caja_diaria sumando a efectivo o tarjeta
 * - Marca ticket como 'cobrado' con su método de pago
 * - Imprime el ticket legal definitivo con Raw Print
 */
export async function cobrarTicketBarra(params: {
  ticket: TicketBarra;
  metodo: 'efectivo' | 'tarjeta' | 'bizum';
  camareroNombre: string;
  configFiscal?: ConfiguracionFiscal | null;
  cajaHoyId?: number;
}): Promise<{ ok: boolean; factura?: any; error?: string }> {
  const { ticket, metodo, camareroNombre, configFiscal, cajaHoyId } = params;

  const cfgFallback: ConfiguracionFiscal = {
    razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.',
    nombre_comercial: 'NEXUS',
    nif_cif: 'B00000000',
    direccion_fiscal: 'Polígono Chinales 45, Córdoba',
    telefono: '',
    iva_defecto: 10,
    pin_administrador: '1234'
  };
  const cfg = configFiscal || cfgFallback;

  const lineas: LineaTicketFiscal[] = (ticket.items || []).map((it) => ({
    nombre: it.nombre + (it.notaExtra ? ` [${it.notaExtra}]` : ''),
    cantidad: it.cantidad,
    precio_unitario: it.precio,
    descuento_porcentaje: 0,
    subtotal_linea: redondearMoneda(it.precio * it.cantidad),
    tipo_iva: it.tipo_iva || cfg.iva_defecto || 10,
    porcentaje_iva: it.porcentaje_iva || cfg.iva_defecto || 10
  }));

  const desglose = calcularDesgloseImpuestosLineas(lineas, 0, ticket.total);
  const totalACobrar = redondearMoneda(ticket.total || desglose.totalGeneral);

  let docEmitido: any = null;
  let numeroLegal = `T-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

  // 1. Intentar emitir vía RPC de Supabase si hay conexión
  if (navigator.onLine) {
    try {
      let hash_anterior = '';
      try {
        const { data: ultimoTicket } = await supabase
          .from('facturas_tickets')
          .select('hash_actual')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        hash_anterior = ultimoTicket?.hash_actual || '';
      } catch (errPrev) {
        console.warn('No se pudo obtener hash_anterior:', errPrev);
      }

      // Probar con el método tal cual, o con tarjeta si bizum no está en el check constraint de la RPC
      const metodoRpc = metodo === 'efectivo' ? 'efectivo' : 'tarjeta';

      const { data: rpcData, error: rpcErr } = await supabase.rpc('emitir_documento_fiscal', {
        p_serie: 'T',
        p_tipo_documento: 'SIMPLIFICADA',
        p_mesa: `BARRA ${ticket.numero_ticket}`,
        p_vendedor: camareroNombre,
        p_metodo_pago: metodoRpc,
        p_importe_efectivo: metodo === 'efectivo' ? totalACobrar : 0,
        p_importe_tarjeta: metodo !== 'efectivo' ? totalACobrar : 0,
        p_subtotal_bruto: desglose.baseImponibleTotal,
        p_descuento_general_porc: 0,
        p_descuento_total_imp: 0,
        p_autorizado_por: null,
        p_tipo_iva: cfg.iva_defecto || 10,
        p_total_final: totalACobrar,
        p_lineas: lineas
      });

      if (!rpcErr && rpcData) {
        docEmitido = rpcData;
        numeroLegal = rpcData.numero_completo || numeroLegal;

        // Calcular Hash VeriFactu SHA-256
        try {
          const hash_actual = await calcularHashVeriFactu(
            numeroLegal,
            String(docEmitido.fecha_expedicion || new Date().toISOString()),
            totalACobrar,
            hash_anterior
          );

          await supabase
            .from('facturas_tickets')
            .update({
              tipo_factura: 'F2',
              metodo_pago: metodo,
              base_imponible_10: desglose.base_imponible_10,
              iva_10: desglose.iva_10,
              base_imponible_21: desglose.base_imponible_21,
              iva_21: desglose.iva_21,
              base_imponible: desglose.baseImponibleTotal,
              cuota_iva: desglose.cuotaIvaTotal,
              hash_anterior,
              hash_actual
            })
            .eq('id', docEmitido.id);
        } catch (errVeri) {
          console.warn('Aviso encadenando VeriFactu ticket barra:', errVeri);
        }
      }
    } catch (errRpc) {
      console.warn('RPC emitir_documento_fiscal no disponible o falló:', errRpc);
    }
  }

  // 2. Actualizar caja_diaria de forma atómica (CAS) si tenemos cajaHoyId
  if (cajaHoyId) {
    try {
      const deltaEf = metodo === 'efectivo' ? totalACobrar : 0;
      const deltaTar = metodo !== 'efectivo' ? totalACobrar : 0;
      await actualizarCajaDiariaAtomica(cajaHoyId, deltaEf, deltaTar);
    } catch (errCaja) {
      console.warn('Aviso al actualizar caja_diaria:', errCaja);
    }
  }

  // 3. Actualizar estado del ticket en tickets_barra
  await actualizarTicketBarra(ticket.id, {
    estado: 'cobrado',
    metodo_pago: metodo
  });

  // 4. Si había comandas_cocina asociadas a este ticket de barra, marcarlas como pagadas
  try {
    await supabase
      .from('comandas_cocina')
      .update({
        pagado: true,
        metodo_pago: metodo,
        camarero_nombre: camareroNombre,
        total_ticket: totalACobrar
      })
      .eq('ticket_number', ticket.numero_ticket)
      .eq('pagado', false);
  } catch (errCom) {
    console.warn('Aviso marcando comanda cocina de barra pagada:', errCom);
  }

  // 5. Imprimir ticket fiscal definitivo con Raw Print
  const facturaFinal = {
    serie: 'T',
    tipo_documento: 'SIMPLIFICADA',
    numero_completo: numeroLegal,
    fecha_expedicion: new Date().toISOString(),
    mesa: `BARRA ${ticket.cliente_alias ? '· ' + ticket.cliente_alias : ''}`,
    vendedor_nombre: camareroNombre,
    metodo_pago: metodo.toUpperCase(),
    subtotal_bruto: desglose.baseImponibleTotal,
    descuento_general_porcentaje: 0,
    descuento_total_importe: 0,
    base_imponible_10: desglose.base_imponible_10,
    iva_10: desglose.iva_10,
    base_imponible_21: desglose.base_imponible_21,
    iva_21: desglose.iva_21,
    base_imponible: desglose.baseImponibleTotal,
    cuota_iva: desglose.cuotaIvaTotal,
    tipo_iva_aplicado: cfg.iva_defecto || 10,
    total_final: totalACobrar,
    lineas: lineas,
    hash_actual: docEmitido?.hash_actual || 'TICKET_BARRA_COBRADO'
  };

  try {
    imprimirDocumentoFiscalHTML(facturaFinal, cfg);
  } catch (errPrint) {
    console.error('Error al imprimir ticket fiscal final:', errPrint);
  }

  return { ok: true, factura: facturaFinal };
}
