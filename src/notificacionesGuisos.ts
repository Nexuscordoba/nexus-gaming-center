// src/notificacionesGuisos.ts
import { supabase } from './supabase';

export type EstadoGuiso = 'buscando_minimo' | 'confirmado' | 'cancelado';
export type ModalidadReservaGuiso = 'barra' | 'takeaway';
export type EstadoPagoReservaGuiso = 'pendiente' | 'pagado';

export interface GuisoProgramado {
  id: string;
  fecha: string;
  fecha_corte?: string | null;
  hora_corte: string;
  nombre_plato: string;
  descripcion: string;
  min_raciones: number;
  precio_barra: number;
  precio_takeaway: number;
  imagen_url: string;
  estado: EstadoGuiso;
  created_at?: string;
}

export interface ReservaGuiso {
  id: string;
  guiso_id: string;
  nombre_cliente: string;
  telefono: string;
  email?: string | null;
  raciones: number;
  modalidad: ModalidadReservaGuiso;
  estado_pago: EstadoPagoReservaGuiso;
  hora_servicio?: string;
  zona_preferida?: 'interior' | 'terraza';
  comensales?: number;
  mesa_id?: string | null;
  created_at?: string;
}

export interface MesaLocal {
  id: string;
  numero: number;
  zona: 'interior' | 'terraza';
  capacidad: number;
  activa: boolean;
  orden?: number;
  created_at?: string;
}

export interface ReservaMesa {
  id: string;
  mesa_id?: string | null;
  reserva_guiso_id?: string | null;
  fecha: string;
  hora_servicio: string;
  zona_preferida: 'interior' | 'terraza';
  comensales: number;
  nombre_cliente: string;
  telefono: string;
  estado: 'confirmada' | 'cancelada' | 'finalizada';
  observaciones?: string;
  created_at?: string;
}

export interface ConfiguracionPagoGuisos {
  telefonoWhatsAppBar: string;
  numeroBizum: string;
  enlacePago: string;
  instruccionesPago: string;
}

const STORAGE_KEY_CONFIG_PAGO = 'nexus_guisos_config_pago';

export const CONFIGURACION_PAGO_DEFAULT: ConfiguracionPagoGuisos = {
  telefonoWhatsAppBar: '34624454242',
  numeroBizum: '624 45 42 42',
  enlacePago: 'https://www.nexusgamingcenter.es/#guisos',
  instruccionesPago: 'Indica en el concepto de Bizum: GUISO y tu Nombre'
};

export const obtenerConfiguracionPagoGuisos = (): ConfiguracionPagoGuisos => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG_PAGO);
    if (!raw) return CONFIGURACION_PAGO_DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      telefonoWhatsAppBar: parsed.telefonoWhatsAppBar || CONFIGURACION_PAGO_DEFAULT.telefonoWhatsAppBar,
      numeroBizum: parsed.numeroBizum || CONFIGURACION_PAGO_DEFAULT.numeroBizum,
      enlacePago: parsed.enlacePago || CONFIGURACION_PAGO_DEFAULT.enlacePago,
      instruccionesPago: parsed.instruccionesPago || CONFIGURACION_PAGO_DEFAULT.instruccionesPago
    };
  } catch {
    return CONFIGURACION_PAGO_DEFAULT;
  }
};

export const guardarConfiguracionPagoGuisos = (
  nuevaConfig: Partial<ConfiguracionPagoGuisos>
): ConfiguracionPagoGuisos => {
  const actual = obtenerConfiguracionPagoGuisos();
  const fusionada: ConfiguracionPagoGuisos = {
    telefonoWhatsAppBar: nuevaConfig.telefonoWhatsAppBar?.trim() || actual.telefonoWhatsAppBar,
    numeroBizum: nuevaConfig.numeroBizum?.trim() || actual.numeroBizum,
    enlacePago: nuevaConfig.enlacePago?.trim() || actual.enlacePago,
    instruccionesPago: nuevaConfig.instruccionesPago !== undefined ? nuevaConfig.instruccionesPago.trim() : actual.instruccionesPago
  };
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG_PAGO, JSON.stringify(fusionada));
  } catch {
    // ignorar quota localstorage
  }
  return fusionada;
};

export interface ResultadoNotificacionEmail {
  enviado: boolean;
  newsletterGuardada: boolean;
  detalle: string;
}

const RESEND_ENDPOINT_GUISOS = '/api/send-guiso-email';

export const obtenerTelefonoBarWhatsApp = (): string =>
  obtenerConfiguracionPagoGuisos().telefonoWhatsAppBar;

export const normalizarTelefonoWhatsApp = (telefonoRaw: string): string => {
  const soloDigitos = String(telefonoRaw || '').replace(/\D+/g, '');
  if (!soloDigitos) return '';
  if (soloDigitos.length === 9 && /^[6789]/.test(soloDigitos)) {
    return `34${soloDigitos}`;
  }
  if (soloDigitos.startsWith('00') && soloDigitos.length > 4) {
    return soloDigitos.slice(2);
  }
  return soloDigitos;
};

/**
 * Calcula una fecha YYYY-MM-DD restando N días a la fecha de servicio del guiso.
 */
export const calcularFechaCorteMenosDias = (fechaServicioISO: string, diasRestar: number = 1): string => {
  if (!fechaServicioISO) return '';
  try {
    const d = new Date(`${fechaServicioISO}T12:00:00`);
    if (isNaN(d.getTime())) return fechaServicioISO;
    d.setDate(d.getDate() - diasRestar);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return fechaServicioISO;
  }
};

export const obtenerFechaCorteEfectiva = (
  guiso: Pick<GuisoProgramado, 'fecha' | 'fecha_corte'>
): string => {
  if (guiso.fecha_corte && String(guiso.fecha_corte).trim()) {
    return String(guiso.fecha_corte).trim();
  }
  return calcularFechaCorteMenosDias(guiso.fecha, 1);
};

export const formatearFechaHumana = (fechaISO: string): string => {
  if (!fechaISO) return '';
  try {
    const fecha = new Date(`${fechaISO}T12:00:00`);
    return fecha.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  } catch {
    return fechaISO;
  }
};

export const formatearFechaCorteHumana = (
  guiso: Pick<GuisoProgramado, 'fecha' | 'fecha_corte' | 'hora_corte'>
): string => {
  const fCorte = obtenerFechaCorteEfectiva(guiso);
  const hCorte = (guiso.hora_corte || '21:00').trim();
  if (!fCorte) return `${hCorte}h`;
  try {
    const d = new Date(`${fCorte}T12:00:00`);
    const diaTexto = d.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    return `${diaTexto} · ${hCorte}h`;
  } catch {
    return `${fCorte} · ${hCorte}h`;
  }
};

export const obtenerPrecioUnitarioReserva = (
  guiso: Pick<GuisoProgramado, 'precio_barra' | 'precio_takeaway'>,
  modalidad: ModalidadReservaGuiso
): number => {
  return modalidad === 'takeaway'
    ? Number(guiso.precio_takeaway || 0)
    : Number(guiso.precio_barra || 0);
};

export const calcularImporteReserva = (
  guiso: Pick<GuisoProgramado, 'precio_barra' | 'precio_takeaway'>,
  raciones: number,
  modalidad: ModalidadReservaGuiso
): number => {
  const unitario = obtenerPrecioUnitarioReserva(guiso, modalidad);
  return Number((unitario * Math.max(1, Number(raciones || 1))).toFixed(2));
};

/**
 * Comprueba si ya se ha superado la fecha y hora exactas de corte de preventa (`fecha_corte` + `hora_corte`).
 */
export const haSuperadoFechaHoraCorte = (
  guiso: Pick<GuisoProgramado, 'fecha' | 'fecha_corte' | 'hora_corte'>
): boolean => {
  try {
    const fechaCorteRef = obtenerFechaCorteEfectiva(guiso);
    if (!fechaCorteRef) return false;
    const horaCorteLimpia = (guiso.hora_corte || '21:00').trim();
    const matchHora = horaCorteLimpia.match(/^(\d{1,2}):(\d{2})/);
    const hh = matchHora ? String(matchHora[1]).padStart(2, '0') : '21';
    const mm = matchHora ? String(matchHora[2]).padStart(2, '0') : '00';
    const fechaHoraCorte = new Date(`${fechaCorteRef}T${hh}:${mm}:00`);
    if (isNaN(fechaHoraCorte.getTime())) return false;
    return Date.now() > fechaHoraCorte.getTime();
  } catch {
    return false;
  }
};

/**
 * Determina si un guiso debe activar el "Plan B" inteligente:
 * - Si su estado es explícitamente 'cancelado'
 * - O si sigue en 'buscando_minimo', no ha alcanzado min_raciones y ya se superó la fecha_corte + hora_corte.
 */
export const estaEnPlanB = (guiso: GuisoProgramado, racionesReservadas: number): boolean => {
  if (guiso.estado === 'cancelado') return true;
  if (guiso.estado === 'confirmado') return false;
  if (racionesReservadas >= Number(guiso.min_raciones || 1)) return false;
  return haSuperadoFechaHoraCorte(guiso);
};

/**
 * Generador de enlace wa.me para el PANEL DE ADMINISTRACIÓN:
 * Permite enviar con un toque al cliente el aviso de confirmación del plato y el enlace/instrucciones de pago.
 */
export const generarEnlaceWhatsAppAdminAClienteConfirmacion = (
  reserva: ReservaGuiso,
  guiso: GuisoProgramado,
  linkPagoPersonalizado?: string
): string => {
  const cfg = obtenerConfiguracionPagoGuisos();
  const telefonoDestino = normalizarTelefonoWhatsApp(reserva.telefono);
  const fechaTexto = formatearFechaHumana(guiso.fecha);
  const modalidadTexto =
    reserva.modalidad === 'takeaway' ? 'Para llevar / Takeaway 🛍️' : 'Para tomar en Barra / Sala 🪑';
  const totalImporte = calcularImporteReserva(guiso, reserva.raciones, reserva.modalidad).toFixed(2);
  const enlacePago = (linkPagoPersonalizado || cfg.enlacePago).trim();
  const fechaCorteTxt = formatearFechaCorteHumana(guiso);

  const mensaje = [
    `¡Hola ${reserva.nombre_cliente}! 👋 Te escribimos desde *Café Bar Nexus* (Chinales 45).`,
    ``,
    `🟢 *¡Buenas noticias! El guiso "${guiso.nombre_plato}" para el ${fechaTexto} YA ESTÁ CONFIRMADO y marcha a los fogones.* 🍲🔥`,
    ``,
    `📋 *Resumen de tu reserva:*`,
    `• Plato: ${guiso.nombre_plato}`,
    `• Cantidad: ${reserva.raciones} ${reserva.raciones === 1 ? 'ración' : 'raciones'}`,
    `• Modalidad: ${modalidadTexto}`,
    `• Total a abonar: *${totalImporte} €*`,
    ``,
    `💳 *Instrucciones de Pago / Bizum:*`,
    `• Bizum al: *${cfg.numeroBizum}*`,
    `• Concepto: GUISO ${String(reserva.nombre_cliente).toUpperCase().slice(0, 15)}`,
    fechaCorteTxt ? `• Límite para abonar: ${fechaCorteTxt}` : '',
    cfg.instruccionesPago ? `• ${cfg.instruccionesPago}` : '',
    enlacePago ? `• O abona online: ${enlacePago}` : '',
    ``,
    `Por favor, responde con el justificante para dejar tu ración 100% asegurada. ¡Muchas gracias y buen provecho! 🥄`
  ].filter(Boolean).join('\n');

  return `https://wa.me/${telefonoDestino}?text=${encodeURIComponent(mensaje)}`;
};

/**
 * Generador de enlace wa.me para el CLIENTE (Vista Pública #guisos):
 */
export const generarEnlaceWhatsAppClienteABar = (
  reserva: Pick<ReservaGuiso, 'nombre_cliente' | 'telefono' | 'raciones' | 'modalidad'>,
  guiso: GuisoProgramado,
  platoConfirmado: boolean,
  telefonoBarPersonalizado?: string
): string => {
  const cfg = obtenerConfiguracionPagoGuisos();
  const telefonoBar = normalizarTelefonoWhatsApp(telefonoBarPersonalizado || cfg.telefonoWhatsAppBar);
  const fechaTexto = formatearFechaHumana(guiso.fecha);
  const modalidadTexto =
    reserva.modalidad === 'takeaway' ? 'Para llevar / Delivery 🛍️' : 'Para tomar en el bar 🪑';
  const totalImporte = calcularImporteReserva(guiso, reserva.raciones, reserva.modalidad).toFixed(2);

  const mensaje = platoConfirmado
    ? [
        `¡Hola equipo de Nexus! 👋`,
        `Acabo de reservar mi ración en el plato *CONFIRMADO*:`,
        ``,
        `🍲 *${guiso.nombre_plato}* (${fechaTexto})`,
        `👤 Nombre: ${reserva.nombre_cliente}`,
        `📞 Teléfono: ${reserva.telefono}`,
        `🥄 Raciones: ${reserva.raciones} (${modalidadTexto})`,
        `💶 Importe total: *${totalImporte} €*`,
        ``,
        `Quiero formalizar ahora el abono directo de mi reserva mediante Bizum o justificante. ¡Gracias!`
      ].join('\n')
    : [
        `¡Hola equipo de Nexus! 👋`,
        `Me acabo de apuntar a la preventa del guiso casero:`,
        ``,
        `🍲 *${guiso.nombre_plato}* (${fechaTexto})`,
        `👤 Nombre: ${reserva.nombre_cliente}`,
        `📞 Teléfono: ${reserva.telefono}`,
        `🥄 Raciones: ${reserva.raciones} (${modalidadTexto})`,
        `💶 Importe previsto al confirmar: *${totalImporte} €*`,
        ``,
        `Quedo atento/a para cuando se alcance el mínimo de raciones. ¡Gracias!`
      ].join('\n');

  return `https://wa.me/${telefonoBar}?text=${encodeURIComponent(mensaje)}`;
};

/**
 * Guarda el correo electrónico del cliente en la lista de newsletter de guisos especiales.
 */
export const guardarSuscripcionNewsletterGuisos = async (datos: {
  email?: string | null;
  nombre_cliente: string;
  telefono: string;
}): Promise<boolean> => {
  const emailLimpio = String(datos.email || '').trim().toLowerCase();
  if (!emailLimpio || !emailLimpio.includes('@')) return false;

  try {
    const { error } = await supabase.from('newsletter_guisos').upsert(
      [
        {
          email: emailLimpio,
          nombre_cliente: datos.nombre_cliente.trim(),
          telefono: datos.telefono.trim(),
          activo: true
        }
      ],
      { onConflict: 'email' }
    );

    if (error) {
      const raw = localStorage.getItem('nexus_newsletter_guisos');
      const lista: Array<{ email: string; nombre: string; telefono: string; fecha: string }> = raw
        ? JSON.parse(raw)
        : [];
      if (!lista.some((item) => item.email === emailLimpio)) {
        lista.push({
          email: emailLimpio,
          nombre: datos.nombre_cliente.trim(),
          telefono: datos.telefono.trim(),
          fecha: new Date().toISOString()
        });
        localStorage.setItem('nexus_newsletter_guisos', JSON.stringify(lista));
      }
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Envío de emails transaccionales de guisos mediante Serverless Function /api/send-guiso-email (Resend):
 * 1. 'reserva_en_cola': Informa al cliente que NO debe pagar nada aún hasta alcanzar el mínimo.
 * 2. 'plato_confirmado_pago': Alerta de fogones confirmados con datos de pago (Bizum/enlace) y fecha de corte.
 * 3. 'plato_cancelado_plan_b': Notifica guiso no preparado y ofrece alternativas o carta del bar.
 */
export const dispararEmailGuiso = async (params: {
  tipo: 'reserva_en_cola' | 'plato_confirmado_pago' | 'plato_cancelado_plan_b';
  reserva: Pick<ReservaGuiso, 'nombre_cliente' | 'telefono' | 'email' | 'raciones' | 'modalidad' | 'hora_servicio' | 'zona_preferida'>;
  guiso: GuisoProgramado;
  zonaMesa?: string;
  platosAlternativos?: Array<{ nombre_plato: string }>;
}): Promise<ResultadoNotificacionEmail> => {
  const { tipo, reserva, guiso, zonaMesa, platosAlternativos } = params;
  const emailDestino = String(reserva.email || '').trim();

  const newsletterGuardada = await guardarSuscripcionNewsletterGuisos({
    email: emailDestino,
    nombre_cliente: reserva.nombre_cliente,
    telefono: reserva.telefono
  });

  if (!emailDestino || !emailDestino.includes('@')) {
    return {
      enviado: false,
      newsletterGuardada,
      detalle: 'Sin correo electrónico proporcionado (opcional).'
    };
  }

  const cfg = obtenerConfiguracionPagoGuisos();
  const fechaTexto = formatearFechaHumana(guiso.fecha);
  const totalImporte = calcularImporteReserva(guiso, reserva.raciones, reserva.modalidad);
  const fechaCorteHumana = formatearFechaCorteHumana(guiso);

  try {
    const res = await fetch(RESEND_ENDPOINT_GUISOS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo,
        email: emailDestino,
        nombre: reserva.nombre_cliente,
        telefono: reserva.telefono,
        plato: guiso.nombre_plato,
        fecha: guiso.fecha,
        fechaHumana: fechaTexto,
        horaServicio: reserva.hora_servicio,
        modalidad: reserva.modalidad,
        raciones: reserva.raciones,
        totalImporte,
        zonaMesa:
          zonaMesa ||
          (reserva.modalidad === 'takeaway'
            ? 'Para llevar (Takeaway)'
            : 'En el local (Sala/Terraza)'),
        numeroBizum: cfg.numeroBizum,
        enlacePago: cfg.enlacePago,
        instruccionesPago: cfg.instruccionesPago,
        fechaCorteHumana,
        telefonoWhatsAppBar: cfg.telefonoWhatsAppBar,
        platosAlternativos: platosAlternativos || []
      })
    });

    if (res.ok) {
      return {
        enviado: true,
        newsletterGuardada,
        detalle: 'Email enviado correctamente vía Resend (/api/send-guiso-email).'
      };
    }
  } catch (err: any) {
    console.warn('Error al disparar email de guiso:', err);
  }

  return {
    enviado: false,
    newsletterGuardada,
    detalle: 'Email procesado (Resend en cola).'
  };
};

/**
 * Mantiene compatibilidad con llamadas existentes usando el nuevo motor de Resend.
 */
export const enviarEmailConfirmacionReservaGuiso = async (params: {
  reserva: ReservaGuiso;
  guiso: GuisoProgramado;
  platoConfirmado: boolean;
  recienConfirmadoPorEstaReserva?: boolean;
}): Promise<ResultadoNotificacionEmail> => {
  const { reserva, guiso, platoConfirmado } = params;
  return dispararEmailGuiso({
    tipo: platoConfirmado ? 'plato_confirmado_pago' : 'reserva_en_cola',
    reserva,
    guiso
  });
};
