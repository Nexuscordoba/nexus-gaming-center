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
    if (!error && data && data.length > 0) {
      data.forEach((r: any) => {
        const match = String(r.numero_ticket || '').match(/B-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
    } else {
      // Intentar calcular sobre caché local
      const local = obtenerCacheLocal();
      local.forEach((t) => {
        const match = String(t.numero_ticket || '').match(/B-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
    }

    const siguiente = maxNum + 1;
    return `B-${String(siguiente).padStart(2, '0')}`;
  } catch (err) {
    console.warn('Error calculando siguiente número de ticket barra, usando fallback:', err);
    const rnd = Math.floor(Math.random() * 90) + 10;
    return `B-${rnd}`;
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
      console.warn('Fallo al consultar tickets_barra en Supabase, utilizando caché local:', error.message);
      return obtenerCacheLocal().filter((t) => t.estado === 'abierto');
    }

    if (data) {
      // Normalizar datos
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

      // Actualizar caché con los abiertos de Supabase
      const local = obtenerCacheLocal().filter((t) => t.estado !== 'abierto');
      guardarCacheLocal([...normalizados, ...local]);

      return normalizados;
    }

    return obtenerCacheLocal().filter((t) => t.estado === 'abierto');
  } catch (err) {
    console.warn('Excepción al cargar tickets_barra abiertos:', err);
    return obtenerCacheLocal().filter((t) => t.estado === 'abierto');
  }
}

/**
 * Crea un nuevo ticket de barra abierto
 */
export async function crearTicketBarra(params: {
  numero_ticket: string;
  cliente_alias?: string;
  items: TicketBarraItem[];
  total: number;
  camarero_nombre?: string;
}): Promise<TicketBarra> {
  const nuevoTicket: TicketBarra = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `b_${Date.now()}`,
    numero_ticket: params.numero_ticket,
    cliente_alias: (params.cliente_alias || '').trim() || 'Barra',
    items: params.items,
    total: redondearMoneda(params.total),
    estado: 'abierto',
    metodo_pago: null,
    camarero_nombre: params.camarero_nombre || 'Barra',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Guardar en local de inmediato para respuesta instantánea
  const cache = obtenerCacheLocal();
  guardarCacheLocal([nuevoTicket, ...cache]);

  // 2. Persistir en Supabase
  try {
    const { data, error } = await supabase
      .from('tickets_barra')
      .insert([
        {
          id: nuevoTicket.id,
          numero_ticket: nuevoTicket.numero_ticket,
          cliente_alias: nuevoTicket.cliente_alias,
          items: nuevoTicket.items,
          total: nuevoTicket.total,
          estado: 'abierto',
          camarero_nombre: nuevoTicket.camarero_nombre
        }
      ])
      .select()
      .maybeSingle();

    if (error) {
      console.warn('No se pudo guardar ticket_barra en Supabase (modo offline/fallback):', error.message);
    } else if (data) {
      nuevoTicket.id = String(data.id);
    }

    // Si contiene artículos cuyo destino es cocina (ej. tapas calientes),
    // enviamos comanda a cocina para que la preparen, identificando claramente que es de barra
    const itemsCocina = params.items.filter((i) => i.destino === 'cocina');
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
  } catch (err) {
    console.warn('Excepción al crear ticket_barra en backend:', err);
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
  // Actualizar en caché local
  const cache = obtenerCacheLocal();
  const index = cache.findIndex((t) => t.id === id);
  if (index !== -1) {
    cache[index] = { ...cache[index], ...updates, updated_at: timestamp };
    guardarCacheLocal(cache);
  }

  try {
    const payload: any = { ...updates, updated_at: timestamp };
    // Borrar campos que no están en la tabla
    delete payload.id;
    delete payload.created_at;

    const { error } = await supabase.from('tickets_barra').update(payload).eq('id', id);
    if (error) {
      console.warn('Error al actualizar ticket_barra en Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Excepción al actualizar ticket_barra:', err);
    return false;
  }
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
    direccion_fiscal: 'Córdoba, España',
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
    direccion_fiscal: 'Córdoba, España',
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
          .order('id', { ascending: false })
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

  // 2. Actualizar caja_diaria si tenemos cajaHoyId
  if (cajaHoyId) {
    try {
      const { data: cajaData } = await supabase
        .from('caja_diaria')
        .select('total_efectivo, total_tarjeta')
        .eq('id', cajaHoyId)
        .maybeSingle();

      if (cajaData) {
        const nuevoEfectivo = redondearMoneda(
          Number(cajaData.total_efectivo || 0) + (metodo === 'efectivo' ? totalACobrar : 0)
        );
        const nuevaTarjeta = redondearMoneda(
          Number(cajaData.total_tarjeta || 0) + (metodo !== 'efectivo' ? totalACobrar : 0)
        );

        await supabase
          .from('caja_diaria')
          .update({
            total_efectivo: nuevoEfectivo,
            total_tarjeta: nuevaTarjeta
          })
          .eq('id', cajaHoyId);
      }
    } catch (errCaja) {
      console.warn('Aviso al actualizar caja_diaria:', errCaja);
    }
  }

  // 3. Actualizar estado del ticket en tickets_barra
  await actualizarTicketBarra(ticket.id, {
    estado: 'cobrado',
    metodo_pago: metodo,
    factura_fiscal_id: docEmitido?.id || null,
    numero_factura_legal: numeroLegal
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
