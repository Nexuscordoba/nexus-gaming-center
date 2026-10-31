// src/fiscalService.ts
import { supabase } from './supabase';

export type UnidadMedida = 'ud' | 'kg' | 'g' | 'l' | 'ml' | 'm' | 'cm';

export interface LineaTicketFiscal {
  articulo_id?: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  subtotal_linea: number;
  tipo_iva?: number;
}

export interface ConfiguracionFiscal {
  id?: string;
  razon_social: string;
  nombre_comercial: string;
  nif_cif: string;
  direccion_fiscal: string;
  telefono: string;
  iva_defecto: number;
  pin_administrador: string;
}

/**
 * Convierte una cantidad desde la unidad usada en el escandallo a la unidad base del artículo ingrediente
 * Ejemplo: Si el café en grano se compra en 'kg' (coste 18€/kg) y la receta lleva 8 'g', el factor es 0.008
 */
export async function calcularHashVeriFactu(
  numeroTicket: string,
  fechaExpedicion: string,
  total: number | string,
  hashAnterior: string
): Promise<string> {
  const totalStr = typeof total === 'number' ? total.toFixed(2) : String(total);
  const cadena = `${numeroTicket}${fechaExpedicion}${totalStr}${hashAnterior}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(cadena);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function obtenerFactorConversion(unidadBase: UnidadMedida, unidadUso: UnidadMedida): number {
  if (unidadBase === unidadUso) return 1;
  // Peso
  if (unidadBase === 'kg' && unidadUso === 'g') return 0.001;
  if (unidadBase === 'g' && unidadUso === 'kg') return 1000;
  // Volumen
  if (unidadBase === 'l' && unidadUso === 'ml') return 0.001;
  if (unidadBase === 'ml' && unidadUso === 'l') return 1000;
  // Longitud / Dimensiones
  if (unidadBase === 'm' && unidadUso === 'cm') return 0.01;
  if (unidadBase === 'cm' && unidadUso === 'm') return 100;
  return 1;
}

/**
 * Calcula el coste exacto de un ingrediente en un escandallo incluyendo su porcentaje de merma
 */
export function calcularCosteIngredienteEscandallo(
  costeUnitarioBase: number,
  unidadBase: UnidadMedida,
  cantidadUsada: number,
  unidadUso: UnidadMedida,
  mermaPorcentaje: number = 0
): number {
  const factor = obtenerFactorConversion(unidadBase, unidadUso);
  const cantidadConvertida = cantidadUsada * factor;
  const factorMerma = 1 + (Number(mermaPorcentaje || 0) / 100);
  return Number((costeUnitarioBase * cantidadConvertida * factorMerma).toFixed(4));
}

/**
 * Obtiene los datos fiscales de la empresa desde Supabase
 */
export async function obtenerConfiguracionFiscal(): Promise<ConfiguracionFiscal> {
  const { data, error } = await supabase
    .from('configuracion_fiscal')
    .select('*')
    .limit(1)
    .single();

  if (error || !data) {
    return {
      razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.',
      nombre_comercial: 'NEXUS',
      nif_cif: 'B00000000',
      direccion_fiscal: 'Córdoba, España',
      telefono: '',
      iva_defecto: 10,
      pin_administrador: '1234'
    };
  }
  return data;
}

/**
 * Valida el PIN del administrador para autorizar descuentos o anulaciones
 */
export async function validarPinAdministrador(pinIntroducido: string): Promise<boolean> {
  const config = await obtenerConfiguracionFiscal();
  return config.pin_administrador.trim() === pinIntroducido.trim();
}

/**
 * Genera una ventana de impresión limpia y optimizada para impresora térmica de 80mm o PDF A4
 * Cumple con el RD 1619/2012 (Reglamento de Facturación) y Ley 11/2021 Antifraude
 */
export function imprimirDocumentoFiscalHTML(factura: any, config: ConfiguracionFiscal) {
  const esRectificativa = factura.serie === 'R' || factura.tipo_documento === 'RECTIFICATIVA';
  const esNominativa = factura.serie === 'F' || factura.tipo_documento === 'NOMINATIVA';

  const tituloLegal = esRectificativa
    ? 'FACTURA RECTIFICATIVA SIMPLIFICADA'
    : esNominativa
    ? 'FACTURA COMPLETA NOMINATIVA'
    : 'FACTURA SIMPLIFICADA';

  const fechaFormateada = new Date(factura.fecha_expedicion || new Date()).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const lineas: LineaTicketFiscal[] = Array.isArray(factura.lineas) ? factura.lineas : [];
  const huellaCorta = factura.hash_actual ? `${factura.hash_actual.substring(0, 16)}...` : 'N/A';

  const filasHTML = lineas
    .map(
      (l) => `
      <tr>
        <td style="padding: 3px 0; text-align: left;">
          ${l.cantidad}x ${l.nombre}
          ${Number(l.descuento_porcentaje) > 0 ? `<br/><small style="color:#555;">(Dto. -${l.descuento_porcentaje}%)</small>` : ''}
        </td>
        <td style="padding: 3px 0; text-align: right; vertical-align: top;">${Number(l.precio_unitario).toFixed(2)}€</td>
        <td style="padding: 3px 0; text-align: right; vertical-align: top; font-weight: bold;">${Number(l.subtotal_linea).toFixed(2)}€</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${tituloLegal} - ${factura.numero_completo}</title>
      <style>
        @page { margin: 4mm; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          color: #000;
          background: #fff;
          width: 76mm;
          margin: 0 auto;
          padding: 4px;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .totales td { padding: 2px 0; font-size: 12px; }
        .legal-box { font-size: 10px; margin-top: 8px; line-height: 1.3; }
      </style>
    </head>
    <body>
      <div class="center">
        <div style="font-size: 16px;" class="bold">${config.nombre_comercial}</div>
        <div class="bold">${config.razon_social}</div>
        <div>NIF/CIF: ${config.nif_cif}</div>
        <div>${config.direccion_fiscal}</div>
        ${config.telefono ? `<div>Tel: ${config.telefono}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="center bold" style="font-size: 13px;">${tituloLegal}</div>
      <div><strong>Nº Doc:</strong> ${factura.numero_completo}</div>
      <div><strong>Fecha:</strong> ${fechaFormateada}</div>
      <div><strong>Mesa/ Ubic.:</strong> ${factura.mesa || 'Barra'}</div>
      <div><strong>Atendido por:</strong> ${factura.vendedor_nombre || 'Camarero'}</div>

      ${
        esRectificativa
          ? `
        <div class="divider"></div>
        <div style="background:#eee; padding:4px; font-size:11px;">
          <strong>DOC. RECTIFICADO:</strong> ${factura.ticket_origen_numero || 'N/A'}<br/>
          <strong>MOTIVO:</strong> ${factura.motivo_rectificacion || 'Devolución / Anulación de operación'}
        </div>
      `
          : ''
      }

      ${
        esNominativa
          ? `
        <div class="divider"></div>
        <div style="font-size:11px;">
          <strong>DATOS DEL CLIENTE:</strong><br/>
          Razón Social: ${factura.cliente_nombre_razon || ''}<br/>
          NIF/CIF: ${factura.cliente_nif || ''}<br/>
          Dirección: ${factura.cliente_direccion || ''}<br/>
          ${factura.ticket_origen_numero ? `Canje Ticket Simplificado: ${factura.ticket_origen_numero}` : ''}
        </div>
      `
          : ''
      }

      <div class="divider"></div>

      <table>
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: left;">Concepto</th>
            <th style="text-align: right;">P.Unit</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${filasHTML}
        </tbody>
      </table>

      <div class="divider"></div>

      <table class="totales">
        ${
          Number(factura.descuento_total_importe) > 0
            ? `
          <tr>
            <td>Subtotal Bruto:</td>
            <td style="text-align: right;">${Number(factura.subtotal_bruto).toFixed(2)} €</td>
          </tr>
          <tr>
            <td>Descuento Aplicado ${factura.descuento_general_porcentaje > 0 ? `(${factura.descuento_general_porcentaje}%)` : ''}:</td>
            <td style="text-align: right;">-${Number(factura.descuento_total_importe).toFixed(2)} €</td>
          </tr>
        `
            : ''
        }
        <tr>
          <td>Base Imponible (${Number(factura.tipo_iva_aplicado || 10).toFixed(0)}%):</td>
          <td style="text-align: right;">${Number(factura.base_imponible).toFixed(2)} €</td>
        </tr>
        <tr>
          <td>Cuota IVA (${Number(factura.tipo_iva_aplicado || 10).toFixed(0)}%):</td>
          <td style="text-align: right;">${Number(factura.cuota_iva).toFixed(2)} €</td>
        </tr>
        <tr style="font-size: 15px; border-top: 1px solid #000;">
          <td class="bold">TOTAL (IVA INCLUIDO):</td>
          <td class="bold" style="text-align: right;">${Number(factura.total_final).toFixed(2)} €</td>
        </tr>
      </table>

      <div class="divider"></div>
      <div><strong>Forma de Pago:</strong> ${String(factura.metodo_pago || 'efectivo').toUpperCase()}</div>
      ${
        factura.autorizado_por
          ? `<div style="font-size:10px;">Dto/Op. autorizada por: ${factura.autorizado_por}</div>`
          : ''
      }

      <div class="divider"></div>
      <div class="center legal-box">
        Documento emitido conforme al RD 1619/2012 y Ley 11/2021.<br/>
        Huella SHA-256: ${huellaCorta}<br/>
        <strong>¡Gracias por su visita!</strong>
      </div>
    </body>
    </html>
  `;

  const ventana = window.open('', '_blank', 'width=400,height=650');
  if (ventana) {
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => {
      ventana.print();
    }, 250);
  }
}

/**
 * Exporta cualquier listado de tickets o ventas a archivo Excel (.csv con BOM UTF-8 nativo para Microsoft Excel)
 */
export function exportarTicketsAExcelCSV(tickets: any[], nombreArchivo: string = 'historico_tickets_nexus') {
  const cabeceras = [
    'Nº Documento',
    'Serie',
    'Tipo',
    'Fecha y Hora',
    'Mesa',
    'Vendedor',
    'Método Pago',
    'Subtotal Bruto (€)',
    'Descuento (€)',
    'Base Imponible (€)',
    'IVA (%)',
    'Cuota IVA (€)',
    'Total Final (€)',
    'Estado Fiscal',
    'Doc. Origen',
    'Cliente NIF',
    'Cliente Razón Social',
    'Hash SHA-256'
  ];

  const filas = tickets.map((t) => [
    t.numero_completo,
    t.serie,
    t.tipo_documento,
    new Date(t.fecha_expedicion).toLocaleString('es-ES'),
    t.mesa || 'Barra',
    t.vendedor_nombre || '',
    t.metodo_pago || '',
    Number(t.subtotal_bruto || 0).toFixed(2).replace('.', ','),
    Number(t.descuento_total_importe || 0).toFixed(2).replace('.', ','),
    Number(t.base_imponible || 0).toFixed(2).replace('.', ','),
    Number(t.tipo_iva_aplicado || 10).toFixed(2).replace('.', ','),
    Number(t.cuota_iva || 0).toFixed(2).replace('.', ','),
    Number(t.total_final || 0).toFixed(2).replace('.', ','),
    t.estado_fiscal || 'EMITIDO',
    t.ticket_origen_numero || '',
    t.cliente_nif || '',
    `"${(t.cliente_nombre_razon || '').replace(/"/g, '""')}"`,
    t.hash_actual || ''
  ]);

  const contenidoCSV =
    '\uFEFF' + // BOM UTF-8 para que Excel en España reconozca tildes y símbolo € perfectamente
    cabeceras.join(';') +
    '\n' +
    filas.map((f) => f.join(';')).join('\n');

  const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Genera un informe PDF formal en A4 de los tickets filtrados para compartir con gestoría o inspección
 */
export function exportarTicketsAPDF(
  tickets: any[],
  config: ConfiguracionFiscal,
  tituloInforme: string = 'INFORME HISTÓRICO DE FACTURACIÓN Y TICKETS'
) {
  const totalGeneral = tickets.reduce((acc, t) => acc + Number(t.total_final || 0), 0);
  const baseGeneral = tickets.reduce((acc, t) => acc + Number(t.base_imponible || 0), 0);
  const ivaGeneral = tickets.reduce((acc, t) => acc + Number(t.cuota_iva || 0), 0);

  const filasHTML = tickets
    .map(
      (t) => `
      <tr>
        <td><strong>${t.numero_completo}</strong></td>
        <td>${t.tipo_documento}</td>
        <td>${new Date(t.fecha_expedicion).toLocaleString('es-ES')}</td>
        <td>${t.vendedor_nombre || '-'}</td>
        <td>${(t.metodo_pago || '').toUpperCase()}</td>
        <td style="text-align:right;">${Number(t.base_imponible).toFixed(2)} €</td>
        <td style="text-align:right;">${Number(t.cuota_iva).toFixed(2)} €</td>
        <td style="text-align:right; font-weight:bold;">${Number(t.total_final).toFixed(2)} €</td>
        <td>${t.estado_fiscal}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${tituloInforme}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
        th { background: #f4f4f4; font-weight: bold; }
        .resumen { margin-top: 15px; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; text-align: right; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${tituloInforme}</h1>
          <div><strong>Razón Social:</strong> ${config.razon_social} | <strong>NIF:</strong> ${config.nif_cif}</div>
          <div><strong>Dirección:</strong> ${config.direccion_fiscal}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Fecha de Emisión:</strong> ${new Date().toLocaleString('es-ES')}</div>
          <div><strong>Total Registros:</strong> ${tickets.length}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nº Documento</th>
            <th>Tipo</th>
            <th>Fecha / Hora</th>
            <th>Vendedor</th>
            <th>Pago</th>
            <th style="text-align:right;">Base Imp.</th>
            <th style="text-align:right;">Cuota IVA</th>
            <th style="text-align:right;">Total</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${filasHTML}
        </tbody>
      </table>

      <div class="resumen">
        <strong>Total Base Imponible:</strong> ${baseGeneral.toFixed(2)} € &nbsp;|&nbsp;
        <strong>Total Cuota IVA:</strong> ${ivaGeneral.toFixed(2)} € &nbsp;|&nbsp;
        <strong>TOTAL FACTURADO: ${totalGeneral.toFixed(2)} €</strong>
      </div>
    </body>
    </html>
  `;

  const ventana = window.open('', '_blank', 'width=950,height=700');
  if (ventana) {
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => {
      ventana.print();
    }, 300);
  }
}