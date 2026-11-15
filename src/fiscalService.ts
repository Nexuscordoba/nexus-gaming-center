// src/fiscalService.ts
import { supabase } from './supabase';

export type UnidadMedida = 'ud' | 'kg' | 'g' | 'l' | 'ml' | 'cl' | 'm' | 'cm';

export interface LineaTicketFiscal {
  articulo_id?: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  subtotal_linea: number;
  tipo_iva?: number;
  porcentaje_iva?: number;
}

export interface DesgloseImpuestosTicket {
  totalConIva10: number;
  base_imponible_10: number;
  iva_10: number;
  totalConIva21: number;
  base_imponible_21: number;
  iva_21: number;
  baseImponibleTotal: number;
  cuotaIvaTotal: number;
  totalGeneral: number;
}

/**
 * Redondeo monetario exacto a 2 decimales evitando errores de coma flotante IEEE 754
 */
export function redondearMoneda(valor: number): number {
  const num = Number(valor || 0);
  if (!Number.isFinite(num)) return 0;
  const signo = num < 0 ? -1 : 1;
  return (signo * Math.round((Math.abs(num) + Number.EPSILON) * 100)) / 100;
}

export function calcularDesgloseImpuestosLineas(
  lineas: LineaTicketFiscal[],
  dtoGeneralPorc: number = 0,
  totalFinalObjetivo?: number
): DesgloseImpuestosTicket {
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

  // Ajuste de céntimo residual en caso de descuento general sobre ticket mixto (10% + 21%)
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

  // Fórmula estándar: Base = TotalConIVA / (1 + (PorcentajeIVA / 100)) e Impuesto = TotalConIVA - Base
  const base_imponible_10 = redondearMoneda(totalConIva10 / 1.1);
  const iva_10 = redondearMoneda(totalConIva10 - base_imponible_10);

  const base_imponible_21 = redondearMoneda(totalConIva21 / 1.21);
  const iva_21 = redondearMoneda(totalConIva21 - base_imponible_21);

  const baseImponibleTotal = redondearMoneda(base_imponible_10 + base_imponible_21);
  const cuotaIvaTotal = redondearMoneda(iva_10 + iva_21);
  const totalGeneral = redondearMoneda(baseImponibleTotal + cuotaIvaTotal);

  return {
    totalConIva10,
    base_imponible_10,
    iva_10,
    totalConIva21,
    base_imponible_21,
    iva_21,
    baseImponibleTotal,
    cuotaIvaTotal,
    totalGeneral
  };
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
  ancho_papel_mm?: number;
  usar_rawbt?: boolean;
  impresora_tipo?: 'auto' | 'navegador' | 'rawbt';
  solo_texto_plano?: boolean;
}

/**
 * Calcula la huella criptográfica SHA-256 encadenada conforme a VeriFactu (Ley 11/2021 Antifraude)
 */
export async function calcularHashVeriFactu(
  numeroTicket: string,
  fechaExpedicion: string,
  total: number | string,
  hashAnterior: string
): Promise<string> {
  const totalStr = typeof total === 'number' ? redondearMoneda(total).toFixed(2) : String(total);
  const cadena = `${numeroTicket}${fechaExpedicion}${totalStr}${hashAnterior}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(cadena);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convierte una cantidad desde la unidad usada en el escandallo a la unidad base del artículo ingrediente
 * Ejemplo: Si el café en grano se compra en 'kg' (coste 18€/kg) y la receta lleva 8 'g', el factor es 0.008
 */
export function obtenerFactorConversion(unidadBase: UnidadMedida, unidadUso: UnidadMedida): number {
  if (unidadBase === unidadUso) return 1;
  // Peso
  if (unidadBase === 'kg' && unidadUso === 'g') return 0.001;
  if (unidadBase === 'g' && unidadUso === 'kg') return 1000;
  // Volumen
  if (unidadBase === 'l' && unidadUso === 'ml') return 0.001;
  if (unidadBase === 'ml' && unidadUso === 'l') return 1000;
  if (unidadBase === 'l' && unidadUso === 'cl') return 0.01;
  if (unidadBase === 'cl' && unidadUso === 'l') return 100;
  if (unidadBase === 'ml' && unidadUso === 'cl') return 10;
  if (unidadBase === 'cl' && unidadUso === 'ml') return 0.1;
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
  const factorMerma = 1 + Number(mermaPorcentaje || 0) / 100;
  return Number((costeUnitarioBase * cantidadConvertida * factorMerma).toFixed(4));
}

/**
 * Obtiene los datos fiscales de la empresa desde Supabase
 */
export async function obtenerConfiguracionFiscal(): Promise<ConfiguracionFiscal> {
  try {
    const { data, error } = await supabase
      .from('configuracion_fiscal')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as ConfiguracionFiscal;
    }
  } catch (err) {
    console.warn('No se pudo cargar configuracion_fiscal desde Supabase, usando configuración por defecto:', err);
  }

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

/**
 * Valida el PIN del administrador para autorizar descuentos o anulaciones
 */
export async function validarPinAdministrador(pinIntroducido: string): Promise<boolean> {
  const config = await obtenerConfiguracionFiscal();
  return config.pin_administrador.trim() === pinIntroducido.trim();
}

/**
 * Limpia y normaliza cadenas de texto para impresión térmica:
 * - Convierte a UTF-8 normalizado NFC (tildes compuestas canónicas).
 * - Elimina secuencias de control binarias ESC/POS crudas (0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F-0x9F)
 *   que provocan volcados binarios o desconfiguran las impresoras térmicas.
 * - Elimina caracteres de control invisibles (BOM, zero-width spaces).
 */
export function limpiarTextoTermico(texto: any): string {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .normalize('NFC')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/**
 * Escapa caracteres HTML especiales manteniendo codificación limpia UTF-8
 */
export function escaparHtml(texto: any): string {
  const limpio = limpiarTextoTermico(texto);
  return limpio
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Detecta si el entorno actual es un navegador corriendo en Android
 */
export function esDispositivoAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || navigator.vendor || '');
}

/**
 * Normaliza y convierte cadenas a 7-bit ASCII puro (0x20 a 0x7E) + \n para RawBT y térmicas.
 * Elimina de raíz cualquier desajuste de páginas de códigos (CP437, Latin1, UTF-8) en la impresora.
 */
export function sanitizarParaRawBT(texto: any): string {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/€/g, 'EUR')
    .replace(/[ºª]/g, '.')
    .replace(/¡/g, '!')
    .replace(/¿/g, '?')
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/**
 * Genera el ticket estructurado en texto plano puro de 7-bit ASCII, formateado para rollos térmicos de 80mm o 58mm.
 * Sin códigos de escape binarios crudos que puedan corromper el búfer de la impresora térmica con RawBT.
 */
export function generarTicketTextoRawBT(
  factura: any,
  config: ConfiguracionFiscal,
  anchoCaracteresPersonalizado?: number
): string {
  const anchoMm = Number(factura?.ancho_papel_mm || config?.ancho_papel_mm || 80) === 58 ? 58 : 80;
  const ancho = anchoCaracteresPersonalizado || (anchoMm === 58 ? 32 : 42);

  const cPadCenter = (texto: string) => {
    const t = sanitizarParaRawBT(texto);
    if (t.length >= ancho) return t.slice(0, ancho);
    const espIzq = Math.floor((ancho - t.length) / 2);
    const espDer = ancho - t.length - espIzq;
    return ' '.repeat(espIzq) + t + ' '.repeat(espDer);
  };

  const cPadLR = (izq: string, der: string) => {
    const tIzq = sanitizarParaRawBT(izq);
    const tDer = sanitizarParaRawBT(der);
    const espacios = Math.max(1, ancho - tIzq.length - tDer.length);
    return tIzq + ' '.repeat(espacios) + tDer;
  };

  const separador = '-'.repeat(ancho);
  const separadorDoble = '='.repeat(ancho);

  const esRectificativa = factura.serie === 'R' || factura.tipo_documento === 'RECTIFICATIVA';
  const esNominativa = factura.serie === 'F' || factura.tipo_documento === 'NOMINATIVA';
  const esPreTicket =
    factura.serie === 'PROFORMA' ||
    String(factura.tipo_documento || '').toUpperCase().includes('PRE-TICKET') ||
    String(factura.tipo_documento || '').toUpperCase().includes('CUENTA MESA');

  const tituloLegal = esRectificativa
    ? 'FACTURA RECTIFICATIVA SIMPLIFICADA'
    : esNominativa
    ? 'FACTURA COMPLETA NOMINATIVA'
    : esPreTicket
    ? 'PRE-TICKET / CUENTA MESA'
    : sanitizarParaRawBT(factura.tipo_documento || 'FACTURA SIMPLIFICADA');

  const fechaFormateada = new Date(factura.fecha_expedicion || new Date()).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const lineas: LineaTicketFiscal[] = Array.isArray(factura.lineas) ? factura.lineas : [];
  const desgloseIvaFactura = calcularDesgloseImpuestosLineas(
    lineas,
    Number(factura.descuento_general_porcentaje || 0),
    factura.total_final !== undefined ? Number(factura.total_final) : undefined
  );
  const base10Print = redondearMoneda(Number(factura.base_imponible_10 ?? desgloseIvaFactura.base_imponible_10));
  const iva10Print = redondearMoneda(Number(factura.iva_10 ?? desgloseIvaFactura.iva_10));
  const base21Print = redondearMoneda(Number(factura.base_imponible_21 ?? desgloseIvaFactura.base_imponible_21));
  const iva21Print = redondearMoneda(Number(factura.iva_21 ?? desgloseIvaFactura.iva_21));

  const buf: string[] = [];

  // Cabecera Comercial
  buf.push(cPadCenter(config.nombre_comercial || 'NEXUS'));
  if (config.razon_social) buf.push(cPadCenter(config.razon_social));
  if (config.nif_cif) buf.push(cPadCenter(`NIF/CIF: ${config.nif_cif}`));
  if (config.direccion_fiscal) buf.push(cPadCenter(config.direccion_fiscal));
  if (config.telefono) buf.push(cPadCenter(`Tel: ${config.telefono}`));

  buf.push(separador);
  buf.push(cPadCenter(tituloLegal));
  if (esPreTicket) {
    buf.push(cPadCenter('(NO VALIDO COMO FACTURA)'));
  }
  buf.push(separador);

  buf.push(cPadLR(`Doc: ${factura.numero_completo || 'T-0000'}`, `Mesa: ${factura.mesa || 'Barra'}`));
  buf.push(cPadLR(`Fecha: ${fechaFormateada}`, `Vend: ${factura.vendedor_nombre || 'Camarero'}`));

  if (esRectificativa && factura.ticket_origen_numero) {
    buf.push(separador);
    buf.push(`DOC. RECTIFICADO: ${sanitizarParaRawBT(factura.ticket_origen_numero)}`);
    if (factura.motivo_rectificacion) {
      buf.push(`MOTIVO: ${sanitizarParaRawBT(factura.motivo_rectificacion)}`);
    }
  }

  if (esNominativa) {
    buf.push(separador);
    buf.push('DATOS CLIENTE:');
    if (factura.cliente_nombre_razon) buf.push(`R.Social: ${sanitizarParaRawBT(factura.cliente_nombre_razon)}`);
    if (factura.cliente_nif) buf.push(`NIF/CIF: ${sanitizarParaRawBT(factura.cliente_nif)}`);
    if (factura.cliente_direccion) buf.push(`Direccion: ${sanitizarParaRawBT(factura.cliente_direccion)}`);
  }

  buf.push(separador);
  const colCant = 4;
  const colTotal = 9;
  const colConcepto = Math.max(10, ancho - colCant - colTotal - 2);

  buf.push(
    'Cant'.padEnd(colCant) + ' ' +
    'Concepto'.padEnd(colConcepto) + ' ' +
    'Total'.padStart(colTotal)
  );
  buf.push(separador);

  for (const l of lineas) {
    const cantStr = `${Number(l.cantidad || 0)}x`.padEnd(colCant);
    const subtotalNum = Number(l.subtotal_linea || 0).toFixed(2);
    const totStr = `${subtotalNum}E`.padStart(colTotal);
    const nombreLimpio = sanitizarParaRawBT(l.nombre || 'Articulo');
    const nomStr = nombreLimpio.slice(0, colConcepto).padEnd(colConcepto);

    buf.push(`${cantStr} ${nomStr} ${totStr}`);
    if (Number(l.descuento_porcentaje) > 0) {
      buf.push(' '.repeat(colCant + 1) + `(Dto. -${l.descuento_porcentaje}%)`);
    }
  }

  buf.push(separador);

  if (Math.abs(Number(factura.descuento_total_importe || 0)) > 0) {
    buf.push(cPadLR('Subtotal Bruto:', `${Number(factura.subtotal_bruto).toFixed(2)} EUR`));
    const dtoPorc = Number(factura.descuento_general_porcentaje || 0) > 0 ? ` (${factura.descuento_general_porcentaje}%)` : '';
    buf.push(cPadLR(`Descuento${dtoPorc}:`, `-${Math.abs(Number(factura.descuento_total_importe)).toFixed(2)} EUR`));
  }

  if (Math.abs(base10Print) > 0 || (Math.abs(base10Print) === 0 && Math.abs(base21Print) === 0)) {
    buf.push(cPadLR('Base Imp. (10%):', `${base10Print.toFixed(2)} EUR`));
    buf.push(cPadLR('Cuota IVA (10%):', `${iva10Print.toFixed(2)} EUR`));
  }

  if (Math.abs(base21Print) > 0) {
    buf.push(cPadLR('Base Imp. (21%):', `${base21Print.toFixed(2)} EUR`));
    buf.push(cPadLR('Cuota IVA (21%):', `${iva21Print.toFixed(2)} EUR`));
  }

  buf.push(separadorDoble);
  buf.push(cPadLR('TOTAL (IVA INC):', `${Number(factura.total_final).toFixed(2)} EUR`));
  buf.push(separadorDoble);

  buf.push(cPadLR('Forma de Pago:', sanitizarParaRawBT(String(factura.metodo_pago || 'EFECTIVO').toUpperCase())));
  if (factura.autorizado_por) {
    buf.push(`Autorizado: ${sanitizarParaRawBT(factura.autorizado_por)}`);
  }

  buf.push(separador);
  if (esPreTicket) {
    buf.push(cPadCenter('DOCUMENTO NO VALIDO COMO FACTURA'));
    buf.push(cPadCenter('Pendiente de cobro definitivo'));
  } else {
    buf.push(cPadCenter('Doc. emitido conf. RD 1619/2012'));
    if (factura.hash_actual && factura.hash_actual !== 'PENDIENTE_DE_COBRO_DEFINITIVO') {
      buf.push(cPadCenter(`Huella: ${String(factura.hash_actual).substring(0, 16)}...`));
    }
  }
  buf.push(cPadCenter('!Gracias por su visita!'));
  buf.push('\n\n\n');

  return buf.join('\n');
}

/**
 * Convierte un Uint8Array de bytes binarios puros directamente a Base64
 * sin pasar por conversiones UTF-8 ni TextDecoder que alteren los bytes de control ESC/POS.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Genera el búfer de bytes para impresión en formato Uint8Array limpio.
 * Convierte el ticket a bytes puros sin conversiones UTF-8 intermedias.
 */
export function generarBytesTicketRawBT(
  factura: any,
  config: ConfiguracionFiscal,
  anchoCaracteresPersonalizado?: number
): Uint8Array {
  const text = generarTicketTextoRawBT(factura, config, anchoCaracteresPersonalizado);
  const bytesList: number[] = [];

  // Comandos ESC/POS estándar de inicialización y fijación de página de códigos PC437
  if (!factura?.solo_texto_plano && !config?.solo_texto_plano) {
    bytesList.push(0x1B, 0x40);       // ESC @: Inicializar impresora y purgar búfer residual
    bytesList.push(0x1B, 0x74, 0x00);  // ESC t 0: Fijar página de códigos 0 (PC437 / ASCII estándar)
  }

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 10) { // Salto de línea (\n, 0x0A)
      bytesList.push(0x0A);
    } else if (code >= 32 && code <= 126) { // Rango ASCII estándar puro
      bytesList.push(code);
    }
  }

  // 4 avances de línea para que el pie del ticket libre la cuchilla térmica
  bytesList.push(0x0A, 0x0A, 0x0A, 0x0A);

  // Comando de corte de papel ESC/POS si no se fuerza modo solo texto plano
  if (!factura?.solo_texto_plano && !config?.solo_texto_plano) {
    bytesList.push(0x1D, 0x56, 0x42, 0x00); // GS V 66 0: Corte de papel parcial
  }

  return new Uint8Array(bytesList);
}

/**
 * Conecta e imprime directamente a la aplicación Android RawBT mediante el esquema oficial
 * rawbt:base64,{base64String} garantizando que los bytes binarios no sufran alteraciones.
 */
export function imprimirConRawBT(
  factura: any,
  config: ConfiguracionFiscal,
  onComplete?: () => void
): boolean {
  try {
    const bytes = generarBytesTicketRawBT(factura, config);
    const base64String = uint8ArrayToBase64(bytes);
    const rawbtUrl = 'rawbt:base64,' + base64String;

    // Disparar la apertura de RawBT con enlace dinámico <a> y navegación directa
    try {
      const link = document.createElement('a');
      link.href = rawbtUrl;
      link.setAttribute('rel', 'noopener noreferrer');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
        } catch (_) {}
      }, 500);
    } catch (_) {}

    try {
      window.location.href = rawbtUrl;
    } catch (_) {}

    if (onComplete) {
      setTimeout(onComplete, 400);
    }

    return true;
  } catch (err) {
    console.error('Error al enviar ticket a RawBT:', err);
    if (onComplete) onComplete();
    return false;
  }
}

/**
 * Genera la impresión limpia y optimizada para impresora térmica de 80mm o 58mm.
 * Cumple con el RD 1619/2012 (Reglamento de Facturación) y Ley 11/2021 Antifraude.
 * - Detecta automáticamente tablets Android y redirige de forma directa y limpia a RawBT.
 * - Sin bloqueos de vista previa: en navegadores de escritorio inicializa un iframe síncrono con dimensiones reales
 *   (sin display: none ni visibility: hidden) para que el motor de Chromium/Edge calcule
 *   el layout de inmediato sin congelarse en "Preparando vista previa...".
 * - Retraso controlado (350ms) entre la inyección del DOM y window.print().
 * - Cero recursos de red o imágenes externas: texto plano e iconos vectoriales puros.
 * - Callback onComplete para liberar de inmediato modales y botones de la interfaz.
 */
export function imprimirDocumentoFiscalHTML(
  factura: any,
  config: ConfiguracionFiscal,
  onComplete?: () => void
) {
  // Si estamos en un dispositivo Android o se ha configurado RawBT, usar la pasarela directa de RawBT
  const usarRawBT =
    factura?.usar_rawbt ||
    config?.usar_rawbt ||
    config?.impresora_tipo === 'rawbt' ||
    (config?.impresora_tipo !== 'navegador' && !factura?.forzar_navegador && esDispositivoAndroid());

  if (usarRawBT) {
    const enviado = imprimirConRawBT(factura, config, onComplete);
    if (enviado) return;
  }
  const anchoMm = Number(factura?.ancho_papel_mm || config?.ancho_papel_mm || 80) === 58 ? 58 : 80;
  const anchoImprimibleMm = anchoMm === 58 ? 48 : 72;

  const esRectificativa = factura.serie === 'R' || factura.tipo_documento === 'RECTIFICATIVA';
  const esNominativa = factura.serie === 'F' || factura.tipo_documento === 'NOMINATIVA';
  const esPreTicket =
    factura.serie === 'PROFORMA' ||
    String(factura.tipo_documento || '').toUpperCase().includes('PRE-TICKET') ||
    String(factura.tipo_documento || '').toUpperCase().includes('CUENTA MESA');

  const tituloLegal = esRectificativa
    ? 'FACTURA RECTIFICATIVA SIMPLIFICADA'
    : esNominativa
    ? 'FACTURA COMPLETA NOMINATIVA'
    : esPreTicket
    ? 'PRE-TICKET / CUENTA MESA'
    : (factura.tipo_documento || 'FACTURA SIMPLIFICADA');

  const fechaFormateada = new Date(factura.fecha_expedicion || new Date()).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const lineas: LineaTicketFiscal[] = Array.isArray(factura.lineas) ? factura.lineas : [];
  const desgloseIvaFactura = calcularDesgloseImpuestosLineas(
    lineas,
    Number(factura.descuento_general_porcentaje || 0),
    factura.total_final !== undefined ? Number(factura.total_final) : undefined
  );
  const base10Print = redondearMoneda(Number(factura.base_imponible_10 ?? desgloseIvaFactura.base_imponible_10));
  const iva10Print = redondearMoneda(Number(factura.iva_10 ?? desgloseIvaFactura.iva_10));
  const base21Print = redondearMoneda(Number(factura.base_imponible_21 ?? desgloseIvaFactura.base_imponible_21));
  const iva21Print = redondearMoneda(Number(factura.iva_21 ?? desgloseIvaFactura.iva_21));

  const tieneHuellaValida =
    factura.hash_actual &&
    factura.hash_actual !== 'PENDIENTE_DE_COBRO_DEFINITIVO' &&
    String(factura.hash_actual).length >= 16;
  const huellaCorta = tieneHuellaValida ? `${String(factura.hash_actual).substring(0, 16)}...` : '';

  const nombreComercial = escaparHtml(config.nombre_comercial || 'NEXUS');
  const razonSocial = escaparHtml(config.razon_social || '');
  const nifCif = escaparHtml(config.nif_cif || '');
  const direccionFiscal = escaparHtml(config.direccion_fiscal || '');
  const telefono = config.telefono ? escaparHtml(config.telefono) : '';

  const numeroCompleto = escaparHtml(factura.numero_completo || 'T-0000');
  const mesa = escaparHtml(factura.mesa || 'Barra');
  const vendedor = escaparHtml(factura.vendedor_nombre || 'Camarero');
  const metodoPago = escaparHtml(String(factura.metodo_pago || 'efectivo').toUpperCase());

  const filasHTML = lineas
    .map((l) => {
      const cant = Number(l.cantidad || 0);
      const nombreLimpio = escaparHtml(l.nombre || 'Artículo');
      const pu = Number(l.precio_unitario || 0).toFixed(2);
      const sub = Number(l.subtotal_linea || 0).toFixed(2);
      const dto = Number(l.descuento_porcentaje || 0);

      return `
      <tr>
        <td class="col-concepto">
          ${cant}x ${nombreLimpio}
          ${dto > 0 ? `<br/><small class="text-muted">(Dto. -${dto}%)</small>` : ''}
        </td>
        <td class="col-precio">${pu}&euro;</td>
        <td class="col-total">${sub}&euro;</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escaparHtml(tituloLegal)} - ${numeroCompleto}</title>
  <style>
    @page {
      size: ${anchoMm}mm auto;
      margin: 0mm !important;
    }
    @media print {
      *, *:before, *:after {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        width: ${anchoMm}mm !important;
        max-width: ${anchoMm}mm !important;
        min-width: ${anchoMm}mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      header, footer, nav, button, .no-print {
        display: none !important;
      }
      .ticket-wrapper {
        width: ${anchoImprimibleMm}mm !important;
        max-width: ${anchoImprimibleMm}mm !important;
        margin: 0 auto !important;
        padding: 2mm 1mm !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
      font-size: ${anchoMm === 58 ? '10px' : '11.5px'};
      line-height: 1.25;
      color: #000000;
      background: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .ticket-wrapper {
      width: ${anchoImprimibleMm}mm;
      margin: 0 auto;
      padding: 3mm 1.5mm;
      text-align: left;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .left { text-align: left; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000000; margin: 4px 0; }
    .divider-double { border-top: 1px double #000000; margin: 5px 0; }
    .text-muted { color: #444444; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: ${anchoMm === 58 ? '9.5px' : '11px'};
    }
    table th {
      border-bottom: 1px solid #000000;
      padding: 2px 0;
      font-weight: bold;
    }
    table td {
      padding: 2px 0;
      vertical-align: top;
    }
    .col-concepto {
      width: 52%;
      text-align: left;
      word-break: break-word;
    }
    .col-precio {
      width: 23%;
      text-align: right;
      white-space: nowrap;
    }
    .col-total {
      width: 25%;
      text-align: right;
      white-space: nowrap;
      font-weight: bold;
    }
    .totales td {
      padding: 1.5px 0;
    }
    .total-destacado {
      font-size: ${anchoMm === 58 ? '12px' : '13.5px'};
      font-weight: bold;
      border-top: 1px solid #000000;
      border-bottom: 1px solid #000000;
      padding: 4px 0 !important;
    }
    .legal-box {
      font-size: ${anchoMm === 58 ? '8.5px' : '9.5px'};
      margin-top: 6px;
      line-height: 1.25;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="ticket-wrapper">
    <div class="center">
      <div style="font-size: 15px;" class="bold">${nombreComercial}</div>
      ${razonSocial ? `<div class="bold">${razonSocial}</div>` : ''}
      ${nifCif ? `<div>NIF/CIF: ${nifCif}</div>` : ''}
      ${direccionFiscal ? `<div>${direccionFiscal}</div>` : ''}
      ${telefono ? `<div>Tel: ${telefono}</div>` : ''}
    </div>

    <div class="divider"></div>

    <div class="center bold" style="font-size: 12.5px;">${escaparHtml(tituloLegal)}</div>
    ${esPreTicket ? '<div class="center text-muted" style="font-size: 9.5px;">(DOCUMENTO NO V&Aacute;LIDO COMO FACTURA)</div>' : ''}
    <div><strong>N&ordm; Doc:</strong> ${numeroCompleto}</div>
    <div><strong>Fecha:</strong> ${fechaFormateada}</div>
    <div><strong>Mesa / Ubic.:</strong> ${mesa}</div>
    <div><strong>Atendido por:</strong> ${vendedor}</div>

    ${
      esRectificativa
        ? `
      <div class="divider"></div>
      <div style="background:#f4f4f4; padding:3px; font-size:10px;">
        <strong>DOC. RECTIFICADO:</strong> ${escaparHtml(factura.ticket_origen_numero || 'N/A')}<br/>
        <strong>MOTIVO:</strong> ${escaparHtml(factura.motivo_rectificacion || 'Devolución / Anulación de operación')}
      </div>`
        : ''
    }

    ${
      esNominativa
        ? `
      <div class="divider"></div>
      <div style="font-size:10.5px;">
        <strong>DATOS DEL CLIENTE:</strong><br/>
        Razón Social: ${escaparHtml(factura.cliente_nombre_razon || '')}<br/>
        NIF/CIF: ${escaparHtml(factura.cliente_nif || '')}<br/>
        Dirección: ${escaparHtml(factura.cliente_direccion || '')}<br/>
        ${factura.ticket_origen_numero ? `Canje Ticket: ${escaparHtml(factura.ticket_origen_numero)}` : ''}
      </div>`
        : ''
    }

    <div class="divider"></div>

    <table>
      <colgroup>
        <col style="width: 52%;" />
        <col style="width: 23%;" />
        <col style="width: 25%;" />
      </colgroup>
      <thead>
        <tr>
          <th class="col-concepto">Concepto</th>
          <th class="col-precio">P.Unit</th>
          <th class="col-total">Total</th>
        </tr>
      </thead>
      <tbody>
        ${filasHTML}
      </tbody>
    </table>

    <div class="divider"></div>

    <table class="totales">
      <colgroup>
        <col style="width: 60%;" />
        <col style="width: 40%;" />
      </colgroup>
      <tbody>
        ${
          Math.abs(Number(factura.descuento_total_importe || 0)) > 0
            ? `
          <tr>
            <td>Subtotal Bruto:</td>
            <td class="right">${Number(factura.subtotal_bruto).toFixed(2)} &euro;</td>
          </tr>
          <tr>
            <td>Descuento ${Number(factura.descuento_general_porcentaje || 0) > 0 ? `(${factura.descuento_general_porcentaje}%)` : ''}:</td>
            <td class="right">-${Math.abs(Number(factura.descuento_total_importe)).toFixed(2)} &euro;</td>
          </tr>`
            : ''
        }
        ${
          Math.abs(base10Print) > 0 || (Math.abs(base10Print) === 0 && Math.abs(base21Print) === 0)
            ? `
          <tr>
            <td>Base Imponible (10%):</td>
            <td class="right">${base10Print.toFixed(2)} &euro;</td>
          </tr>
          <tr>
            <td>Cuota IVA (10%):</td>
            <td class="right">${iva10Print.toFixed(2)} &euro;</td>
          </tr>`
            : ''
        }
        ${
          Math.abs(base21Print) > 0
            ? `
          <tr>
            <td>Base Imponible (21%):</td>
            <td class="right">${base21Print.toFixed(2)} &euro;</td>
          </tr>
          <tr>
            <td>Cuota IVA (21%):</td>
            <td class="right">${iva21Print.toFixed(2)} &euro;</td>
          </tr>`
            : ''
        }
        <tr class="total-destacado">
          <td class="bold">TOTAL:</td>
          <td class="bold right">${Number(factura.total_final).toFixed(2)} &euro;</td>
        </tr>
      </tbody>
    </table>

    <div class="divider"></div>
    <div><strong>Forma de Pago:</strong> ${metodoPago}</div>
    ${
      factura.autorizado_por
        ? `<div style="font-size:9.5px;">Dto/Op. autorizada por: ${escaparHtml(factura.autorizado_por)}</div>`
        : ''
    }

    <div class="divider"></div>
    <div class="center legal-box">
      ${
        esPreTicket
          ? '<strong>DOCUMENTO INFORMATIVO PREVIO AL COBRO</strong><br/>Pendiente de cobro definitivo.<br/>'
          : 'Documento emitido conforme al RD 1619/2012 y Ley 11/2021.<br/>'
      }
      ${huellaCorta ? `Huella SHA-256: ${huellaCorta}<br/>` : ''}
      <strong>&iexcl;Gracias por su visita!</strong>
    </div>
  </div>
</body>
</html>`;

  // Control de finalización y limpieza de estados para evitar interfaces colgadas
  let terminado = false;
  const notificarFin = () => {
    if (terminado) return;
    terminado = true;
    if (onComplete) {
      try {
        onComplete();
      } catch (_) {}
    }
  };

  try {
    const iframeId = 'nexus-thermal-print-frame';
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;

    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.setAttribute('title', 'Ticket de Impresion Termica');
      iframe.setAttribute('aria-hidden', 'true');
      // Importante: No usar display: none ni visibility: hidden ni 0px.
      // Chrome/Edge requiere que el elemento tenga layout geométrico válido (>0px) y opacidad para
      // poder calcular el render tree y generar la vista previa sin quedarse en bucle infinito.
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = `${anchoMm}mm`;
      iframe.style.height = '400mm';
      iframe.style.border = '0';
      iframe.style.margin = '0';
      iframe.style.padding = '0';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);
    } else {
      iframe.style.width = `${anchoMm}mm`;
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      console.error('No se pudo acceder al documento del frame de impresión.');
      notificarFin();
      return;
    }

    // Escritura síncrona en el DOM del iframe
    doc.open('text/html', 'replace');
    doc.write(html);
    doc.close();

    // Retraso controlado (350ms) para garantizar que el DOM esté completamente parseado,
    // layout calculado y estilos aplicados antes de invocar window.print()
    setTimeout(() => {
      try {
        const win = iframe?.contentWindow;
        if (win) {
          win.focus();
          win.onafterprint = () => {
            notificarFin();
          };
          win.print();
          // Fallback de seguridad por si el navegador o driver no dispara onafterprint
          setTimeout(notificarFin, 1000);
        } else {
          notificarFin();
        }
      } catch (err) {
        console.error('Error al invocar impresión térmica:', err);
        notificarFin();
      }
    }, 350);
  } catch (err) {
    console.error('Error en inicialización de frame de impresión térmica:', err);
    notificarFin();
  }
}

/**
 * Genera el ticket en formato texto plano puro (UTF-8 estándar limpio), alineado en columnas fijas,
 * sin incluir caracteres binarios de control ESC/POS crudos.
 * Ideal para impresoras térmicas en modo texto directo, buffers de impresión o verificación.
 */
export function generarTicketTextoPlano(
  factura: any,
  config: ConfiguracionFiscal,
  anchoCaracteres: number = 42
): string {
  const cPadCenter = (texto: string, ancho: number) => {
    const t = limpiarTextoTermico(texto);
    if (t.length >= ancho) return t.slice(0, ancho);
    const espIzq = Math.floor((ancho - t.length) / 2);
    const espDer = ancho - t.length - espIzq;
    return ' '.repeat(espIzq) + t + ' '.repeat(espDer);
  };

  const cPadLR = (izq: string, der: string, ancho: number) => {
    const tIzq = limpiarTextoTermico(izq);
    const tDer = limpiarTextoTermico(der);
    const espacios = Math.max(1, ancho - tIzq.length - tDer.length);
    return tIzq + ' '.repeat(espacios) + tDer;
  };

  const separador = '-'.repeat(anchoCaracteres);
  const separadorDoble = '='.repeat(anchoCaracteres);

  const esRectificativa = factura.serie === 'R' || factura.tipo_documento === 'RECTIFICATIVA';
  const esNominativa = factura.serie === 'F' || factura.tipo_documento === 'NOMINATIVA';
  const esPreTicket =
    factura.serie === 'PROFORMA' ||
    String(factura.tipo_documento || '').toUpperCase().includes('PRE-TICKET') ||
    String(factura.tipo_documento || '').toUpperCase().includes('CUENTA MESA');

  const tituloLegal = esRectificativa
    ? 'FACTURA RECTIFICATIVA SIMPLIFICADA'
    : esNominativa
    ? 'FACTURA COMPLETA NOMINATIVA'
    : esPreTicket
    ? 'PRE-TICKET / CUENTA MESA'
    : (factura.tipo_documento || 'FACTURA SIMPLIFICADA');

  const fechaFormateada = new Date(factura.fecha_expedicion || new Date()).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const lineas: LineaTicketFiscal[] = Array.isArray(factura.lineas) ? factura.lineas : [];
  const desgloseIvaFactura = calcularDesgloseImpuestosLineas(
    lineas,
    Number(factura.descuento_general_porcentaje || 0),
    factura.total_final !== undefined ? Number(factura.total_final) : undefined
  );
  const base10Print = redondearMoneda(Number(factura.base_imponible_10 ?? desgloseIvaFactura.base_imponible_10));
  const iva10Print = redondearMoneda(Number(factura.iva_10 ?? desgloseIvaFactura.iva_10));
  const base21Print = redondearMoneda(Number(factura.base_imponible_21 ?? desgloseIvaFactura.base_imponible_21));
  const iva21Print = redondearMoneda(Number(factura.iva_21 ?? desgloseIvaFactura.iva_21));

  const buf: string[] = [];

  // Cabecera Empresa
  buf.push(cPadCenter(config.nombre_comercial || 'NEXUS', anchoCaracteres));
  if (config.razon_social) buf.push(cPadCenter(config.razon_social, anchoCaracteres));
  if (config.nif_cif) buf.push(cPadCenter(`NIF/CIF: ${config.nif_cif}`, anchoCaracteres));
  if (config.direccion_fiscal) buf.push(cPadCenter(config.direccion_fiscal, anchoCaracteres));
  if (config.telefono) buf.push(cPadCenter(`Tel: ${config.telefono}`, anchoCaracteres));

  buf.push(separador);
  buf.push(cPadCenter(tituloLegal, anchoCaracteres));
  if (esPreTicket) {
    buf.push(cPadCenter('(DOCUMENTO NO VALIDO COMO FACTURA)', anchoCaracteres));
  }
  buf.push(separador);

  buf.push(cPadLR(`Doc: ${factura.numero_completo || 'T-0000'}`, `Mesa: ${factura.mesa || 'Barra'}`, anchoCaracteres));
  buf.push(cPadLR(`Fecha: ${fechaFormateada}`, `Vendedor: ${factura.vendedor_nombre || 'Camarero'}`, anchoCaracteres));

  if (esRectificativa && factura.ticket_origen_numero) {
    buf.push(separador);
    buf.push(`DOC. RECTIFICADO: ${limpiarTextoTermico(factura.ticket_origen_numero)}`);
    if (factura.motivo_rectificacion) {
      buf.push(`MOTIVO: ${limpiarTextoTermico(factura.motivo_rectificacion)}`);
    }
  }

  if (esNominativa) {
    buf.push(separador);
    buf.push('DATOS CLIENTE:');
    if (factura.cliente_nombre_razon) buf.push(`R.Social: ${limpiarTextoTermico(factura.cliente_nombre_razon)}`);
    if (factura.cliente_nif) buf.push(`NIF/CIF: ${limpiarTextoTermico(factura.cliente_nif)}`);
    if (factura.cliente_direccion) buf.push(`Direccion: ${limpiarTextoTermico(factura.cliente_direccion)}`);
  }

  buf.push(separador);
  const colCant = 4;
  const colTotal = 8;
  const colConcepto = Math.max(10, anchoCaracteres - colCant - colTotal - 2);
  buf.push(
    'Cant'.padEnd(colCant) + ' ' +
    'Concepto'.padEnd(colConcepto) + ' ' +
    'Total'.padStart(colTotal)
  );
  buf.push(separador);

  for (const l of lineas) {
    const cantStr = `${Number(l.cantidad || 0)}x`.padEnd(colCant);
    const totStr = `${Number(l.subtotal_linea || 0).toFixed(2)}E`.padStart(colTotal);
    const nomStr = limpiarTextoTermico(l.nombre).slice(0, colConcepto).padEnd(colConcepto);
    buf.push(`${cantStr} ${nomStr} ${totStr}`);
    if (Number(l.descuento_porcentaje) > 0) {
      buf.push(' '.repeat(colCant + 1) + `(Dto. -${l.descuento_porcentaje}%)`);
    }
  }

  buf.push(separador);

  if (Math.abs(Number(factura.descuento_total_importe || 0)) > 0) {
    buf.push(cPadLR('Subtotal Bruto:', `${Number(factura.subtotal_bruto).toFixed(2)} EUR`, anchoCaracteres));
    const dtoPorc = Number(factura.descuento_general_porcentaje || 0) > 0 ? ` (${factura.descuento_general_porcentaje}%)` : '';
    buf.push(cPadLR(`Descuento${dtoPorc}:`, `-${Math.abs(Number(factura.descuento_total_importe)).toFixed(2)} EUR`, anchoCaracteres));
  }

  if (Math.abs(base10Print) > 0 || (Math.abs(base10Print) === 0 && Math.abs(base21Print) === 0)) {
    buf.push(cPadLR('Base Imponible (10%):', `${base10Print.toFixed(2)} EUR`, anchoCaracteres));
    buf.push(cPadLR('Cuota IVA (10%):', `${iva10Print.toFixed(2)} EUR`, anchoCaracteres));
  }

  if (Math.abs(base21Print) > 0) {
    buf.push(cPadLR('Base Imponible (21%):', `${base21Print.toFixed(2)} EUR`, anchoCaracteres));
    buf.push(cPadLR('Cuota IVA (21%):', `${iva21Print.toFixed(2)} EUR`, anchoCaracteres));
  }

  buf.push(separadorDoble);
  buf.push(cPadLR('TOTAL (IVA INCLUIDO):', `${Number(factura.total_final).toFixed(2)} EUR`, anchoCaracteres));
  buf.push(separadorDoble);

  buf.push(cPadLR('Forma de Pago:', String(factura.metodo_pago || 'EFECTIVO').toUpperCase(), anchoCaracteres));
  if (factura.autorizado_por) {
    buf.push(`Autorizado por: ${limpiarTextoTermico(factura.autorizado_por)}`);
  }

  buf.push(separador);
  if (esPreTicket) {
    buf.push(cPadCenter('DOCUMENTO NO VALIDO COMO FACTURA', anchoCaracteres));
    buf.push(cPadCenter('Pendiente de cobro definitivo', anchoCaracteres));
  } else {
    buf.push(cPadCenter('Doc. emitido conf. RD 1619/2012 y Ley 11/2021', anchoCaracteres));
    if (factura.hash_actual && factura.hash_actual !== 'PENDIENTE_DE_COBRO_DEFINITIVO') {
      buf.push(cPadCenter(`Huella: ${String(factura.hash_actual).substring(0, 16)}...`, anchoCaracteres));
    }
  }
  buf.push(cPadCenter('¡Gracias por su visita!', anchoCaracteres));
  buf.push('\n\n\n');

  return buf.join('\n');
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
    'Base Imponible 10% (€)',
    'Cuota IVA 10% (€)',
    'Base Imponible 21% (€)',
    'Cuota IVA 21% (€)',
    'Base Imponible Total (€)',
    'Cuota IVA Total (€)',
    'Total Final (€)',
    'Estado Fiscal',
    'Doc. Origen',
    'Cliente NIF',
    'Cliente Razón Social',
    'Hash SHA-256'
  ];

  const filas = tickets.map((t) => {
    const desglose = calcularDesgloseImpuestosLineas(
      Array.isArray(t.lineas) ? t.lineas : [],
      Number(t.descuento_general_porcentaje || 0),
      t.total_final !== undefined ? Number(t.total_final) : undefined
    );
    const b10 = Number(t.base_imponible_10 ?? desglose.base_imponible_10);
    const i10 = Number(t.iva_10 ?? desglose.iva_10);
    const b21 = Number(t.base_imponible_21 ?? desglose.base_imponible_21);
    const i21 = Number(t.iva_21 ?? desglose.iva_21);
    const bTot = Number(t.base_imponible ?? desglose.baseImponibleTotal);
    const iTot = Number(t.cuota_iva ?? desglose.cuotaIvaTotal);

    return [
      limpiarTextoTermico(t.numero_completo),
      limpiarTextoTermico(t.serie),
      limpiarTextoTermico(t.tipo_documento),
      new Date(t.fecha_expedicion).toLocaleString('es-ES'),
      limpiarTextoTermico(t.mesa || 'Barra'),
      limpiarTextoTermico(t.vendedor_nombre || ''),
      limpiarTextoTermico(t.metodo_pago || ''),
      Number(t.subtotal_bruto || 0).toFixed(2).replace('.', ','),
      Number(t.descuento_total_importe || 0).toFixed(2).replace('.', ','),
      b10.toFixed(2).replace('.', ','),
      i10.toFixed(2).replace('.', ','),
      b21.toFixed(2).replace('.', ','),
      i21.toFixed(2).replace('.', ','),
      bTot.toFixed(2).replace('.', ','),
      iTot.toFixed(2).replace('.', ','),
      Number(t.total_final || 0).toFixed(2).replace('.', ','),
      limpiarTextoTermico(t.estado_fiscal || 'EMITIDO'),
      limpiarTextoTermico(t.ticket_origen_numero || ''),
      limpiarTextoTermico(t.cliente_nif || ''),
      `"${limpiarTextoTermico(t.cliente_nombre_razon || '').replace(/"/g, '""')}"`,
      limpiarTextoTermico(t.hash_actual || '')
    ];
  });

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
  const totalGeneral = redondearMoneda(tickets.reduce((acc, t) => acc + Number(t.total_final || 0), 0));
  const baseGeneral = redondearMoneda(tickets.reduce((acc, t) => acc + Number(t.base_imponible || 0), 0));
  const ivaGeneral = redondearMoneda(tickets.reduce((acc, t) => acc + Number(t.cuota_iva || 0), 0));

  const filasHTML = tickets
    .map(
      (t) => `
      <tr>
        <td><strong>${escaparHtml(t.numero_completo)}</strong></td>
        <td>${escaparHtml(t.tipo_documento)}</td>
        <td>${new Date(t.fecha_expedicion).toLocaleString('es-ES')}</td>
        <td>${escaparHtml(t.vendedor_nombre || '-')}</td>
        <td>${escaparHtml((t.metodo_pago || '').toUpperCase())}</td>
        <td style="text-align:right;">${Number(t.base_imponible || 0).toFixed(2)} &euro;</td>
        <td style="text-align:right;">${Number(t.cuota_iva || 0).toFixed(2)} &euro;</td>
        <td style="text-align:right; font-weight:bold;">${Number(t.total_final || 0).toFixed(2)} &euro;</td>
        <td>${escaparHtml(t.estado_fiscal)}</td>
      </tr>
    `
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>${escaparHtml(tituloInforme)}</title>
  <style>
    @page { margin: 10mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 15px; margin: 0; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
    th, td { border: 1px solid #ccc; padding: 5px; text-align: left; }
    th { background: #f4f4f4; font-weight: bold; }
    .resumen { margin-top: 15px; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; text-align: right; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escaparHtml(tituloInforme)}</h1>
      <div><strong>Razón Social:</strong> ${escaparHtml(config.razon_social)} | <strong>NIF:</strong> ${escaparHtml(config.nif_cif)}</div>
      <div><strong>Dirección:</strong> ${escaparHtml(config.direccion_fiscal)}</div>
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
    <strong>Total Base Imponible:</strong> ${baseGeneral.toFixed(2)} &euro; &nbsp;|&nbsp;
    <strong>Total Cuota IVA:</strong> ${ivaGeneral.toFixed(2)} &euro; &nbsp;|&nbsp;
    <strong>TOTAL FACTURADO: ${totalGeneral.toFixed(2)} &euro;</strong>
  </div>
</body>
</html>`;

  const ventana = window.open('', '_blank', 'width=950,height=700');
  if (ventana) {
    try {
      ventana.document.open('text/html', 'replace');
      ventana.document.write(html);
      ventana.document.close();
      ventana.focus();
      ventana.onafterprint = () => {
        try { ventana.close(); } catch (_) {}
      };
      setTimeout(() => {
        ventana.print();
      }, 350);
    } catch (e) {
      console.warn('Error al imprimir informe PDF:', e);
    }
  }
}
