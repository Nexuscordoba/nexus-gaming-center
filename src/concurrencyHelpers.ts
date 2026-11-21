// src/concurrencyHelpers.ts
import { supabase } from './supabase';
import { redondearMoneda } from './fiscalService';

/**
 * Descuenta stock usando Optimistic Concurrency Control (Compare-And-Swap)
 * para evitar condiciones de carrera (lost updates) bajo pedidos simultáneos.
 */
export async function descontarStockConCAS(params: {
  tabla: 'productos_carta' | 'articulos_cafeteria';
  id: number | string;
  cantidad: number;
  permitirNegativo?: boolean;
  maxIntentos?: number;
}): Promise<{ ok: boolean; stockAnterior?: number; nuevoStock?: number; motivo?: string }> {
  const { tabla, id, cantidad, permitirNegativo = false, maxIntentos = 6 } = params;
  if (cantidad <= 0) return { ok: true };

  for (let intento = 0; intento < maxIntentos; intento++) {
    const { data: row, error: readErr } = await supabase
      .from(tabla)
      .select('id, stock_actual, controla_stock')
      .eq('id', id)
      .maybeSingle();

    if (readErr || !row) {
      return { ok: false, motivo: readErr?.message || 'ARTICULO_NO_ENCONTRADO' };
    }

    if (row.controla_stock === false) {
      return { ok: true, stockAnterior: Number(row.stock_actual ?? 0), nuevoStock: Number(row.stock_actual ?? 0) };
    }

    const stockActual = Number(row.stock_actual ?? 0);
    if (!permitirNegativo && stockActual < cantidad) {
      return {
        ok: false,
        stockAnterior: stockActual,
        nuevoStock: stockActual,
        motivo: 'STOCK_INSUFICIENTE'
      };
    }

    const nuevoStock = Number((stockActual - cantidad).toFixed(4));

    let query = supabase
      .from(tabla)
      .update({ stock_actual: nuevoStock })
      .eq('id', id);

    query = row.stock_actual === null ? query.is('stock_actual', null) : query.eq('stock_actual', row.stock_actual);

    const { data: updated, error: updErr } = await query.select('id, stock_actual').maybeSingle();

    if (!updErr && updated) {
      return { ok: true, stockAnterior: stockActual, nuevoStock: Number(updated.stock_actual) };
    }

    // Backoff corto con jitter antes de reintentar CAS
    await new Promise((r) => setTimeout(r, 15 + Math.floor(Math.random() * 40)));
  }

  return { ok: false, motivo: 'CONCURRENCIA_EXCEDIDA' };
}

/**
 * Actualiza caja_diaria de forma segura ante cobros concurrentes mediante CAS.
 */
export async function actualizarCajaDiariaAtomica(
  cajaId: number,
  deltaEfectivo: number,
  deltaTarjeta: number,
  maxIntentos = 6
): Promise<{ ok: boolean; total_efectivo?: number; total_tarjeta?: number }> {
  if (!cajaId || (deltaEfectivo === 0 && deltaTarjeta === 0)) return { ok: true };

  for (let intento = 0; intento < maxIntentos; intento++) {
    const { data: cajaData, error: readErr } = await supabase
      .from('caja_diaria')
      .select('id, total_efectivo, total_tarjeta')
      .eq('id', cajaId)
      .maybeSingle();

    if (readErr || !cajaData) return { ok: false };

    const prevEf = Number(cajaData.total_efectivo ?? 0);
    const prevTar = Number(cajaData.total_tarjeta ?? 0);
    const nuevoEf = redondearMoneda(prevEf + deltaEfectivo);
    const nuevaTar = redondearMoneda(prevTar + deltaTarjeta);

    const { data: updated, error: updErr } = await supabase
      .from('caja_diaria')
      .update({ total_efectivo: nuevoEf, total_tarjeta: nuevaTar })
      .eq('id', cajaId)
      .eq('total_efectivo', cajaData.total_efectivo)
      .eq('total_tarjeta', cajaData.total_tarjeta)
      .select('id, total_efectivo, total_tarjeta')
      .maybeSingle();

    if (!updErr && updated) {
      return {
        ok: true,
        total_efectivo: Number(updated.total_efectivo),
        total_tarjeta: Number(updated.total_tarjeta)
      };
    }

    await new Promise((r) => setTimeout(r, 20 + Math.floor(Math.random() * 45)));
  }

  return { ok: false };
}

/**
 * Obtiene el último hash_actual VeriFactu ordenado cronológicamente por created_at
 * (nunca por id, ya que id es UUID v4 aleatorio).
 */
export async function obtenerUltimoHashVeriFactu(): Promise<string> {
  try {
    const { data } = await supabase
      .from('facturas_tickets')
      .select('hash_actual')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.hash_actual || '';
  } catch {
    return '';
  }
}
