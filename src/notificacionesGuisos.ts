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
  created_at?: string;
}

export interface ResultadoNotificacionEmail {
  enviado: boolean;
  newsletterGuardada: boolean;
  detalle: string;
}

const RESEND_API_KEY = (import.meta.env.VITE_RESEND_API_KEY as string | undefined) || '';
const RESEND_ENDPOINT =
  (import.meta.env.VITE_RESEND_ENDPOINT as string | undefined) || '/api/send-confirmation';
const WHATSAPP_BAR_NEXUS =
  (import.meta.env.VITE_WHATSAPP_BAR_PHONE as string | undefined) || '34600000000';
const ENLACE_PAGO_POR_DEFECTO =
  (import.meta.env.VITE_GUISOS_PAYMENT_URL as string | undefined) ||
  'https://www.nexusgamingcenter.es/#guisos';

export const obtenerTelefonoBarWhatsApp = (): string => WHATSAPP_BAR_NEXUS;

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
  const telefonoDestino = normalizarTelefonoWhatsApp(reserva.telefono);
  const fechaTexto = formatearFechaHumana(guiso.fecha);
  const modalidadTexto =
    reserva.modalidad === 'takeaway' ? 'Para llevar / Takeaway 🛍️' : 'Para tomar en Barra / Sala 🪑';
  const totalImporte = calcularImporteReserva(guiso, reserva.raciones, reserva.modalidad).toFixed(2);
  const enlacePago = (linkPagoPersonalizado || ENLACE_PAGO_POR_DEFECTO).trim();

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
    `💳 Para dejar tu ración 100% formalizada, puedes completar el abono desde aquí o responder a este mensaje con tu justificante / confirmación:`,
    `${enlacePago}`,
    ``,
    `¡Muchas gracias y buen provecho! 🥄`
  ].join('\n');

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
  const telefonoBar = normalizarTelefonoWhatsApp(telefonoBarPersonalizado || WHATSAPP_BAR_NEXUS);
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
        `Quiero formalizar ahora el abono directo de mi reserva para dejarla asegurada. ¡Gracias!`
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
 * Envía el email de confirmación de reserva mediante Resend y registra el correo en la newsletter.
 */
export const enviarEmailConfirmacionReservaGuiso = async (params: {
  reserva: ReservaGuiso;
  guiso: GuisoProgramado;
  platoConfirmado: boolean;
  recienConfirmadoPorEstaReserva?: boolean;
}): Promise<ResultadoNotificacionEmail> => {
  const { reserva, guiso, platoConfirmado, recienConfirmadoPorEstaReserva } = params;
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

  const fechaTexto = formatearFechaHumana(guiso.fecha);
  const modalidadTexto =
    reserva.modalidad === 'takeaway' ? 'Para llevar / Delivery' : 'Para tomar en el bar (Sala/Barra)';
  const importeTotal = calcularImporteReserva(guiso, reserva.raciones, reserva.modalidad).toFixed(2);

  const asunto = platoConfirmado
    ? `🟢 ¡Ración Asegurada! ${guiso.nombre_plato} (${fechaTexto}) · Café Bar Nexus`
    : `🍲 Reserva Registrada: ${guiso.nombre_plato} (${fechaTexto}) · Café Bar Nexus`;

  const htmlContent = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; background: #0c0d14; color: #e2e8f0; border-radius: 16px; padding: 28px; border: 1px solid #f59e0b40;">
      <h2 style="color: #fbbf24; margin-top: 0;">🍲 Guisos de la Casa · Café Bar Nexus</h2>
      <p>¡Hola <strong>${reserva.nombre_cliente}</strong>!</p>
      <p>${
        platoConfirmado
          ? recienConfirmadoPorEstaReserva
            ? '🎉 ¡Con tu reserva acabamos de alcanzar el mínimo de raciones! El plato queda oficialmente <strong>CONFIRMADO</strong> y se cocinará sin falta.'
            : '⚡ Este guiso ya ha alcanzado su mínimo y está <strong>CONFIRMADO</strong> en los fogones. Tu ración queda reservada.'
          : 'Hemos registrado tu reserva gratuita en nuestra preventa. En cuanto alcancemos el mínimo de raciones antes del cierre de preventa, te avisaremos para confirmar fogones.'
      }</p>
      <div style="background: #131722; border-radius: 12px; padding: 16px; margin: 20px 0; border: 1px solid #ffffff1a;">
        <p style="margin: 4px 0;"><strong>Plato:</strong> ${guiso.nombre_plato}</p>
        <p style="margin: 4px 0;"><strong>Fecha:</strong> ${fechaTexto}</p>
        <p style="margin: 4px 0;"><strong>Raciones:</strong> ${reserva.raciones}</p>
        <p style="margin: 4px 0;"><strong>Modalidad:</strong> ${modalidadTexto}</p>
        <p style="margin: 4px 0;"><strong>Importe Total:</strong> <span style="color: #34d399; font-weight: bold;">${importeTotal} €</span></p>
      </div>
      <p style="font-size: 12px; color: #94a3b8;">📍 Avenida principal de Chinales 45, 14007 Córdoba · <a href="https://www.nexusgamingcenter.es/#guisos" style="color: #38bdf8;">nexusgamingcenter.es/#guisos</a></p>
    </div>
  `;

  try {
    const responseEndpoint = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'reserva_guiso',
        email: emailDestino,
        nombre: reserva.nombre_cliente,
        telefono: reserva.telefono,
        asunto,
        plato: guiso.nombre_plato,
        fechaEvento: guiso.fecha,
        raciones: reserva.raciones,
        modalidad: reserva.modalidad,
        precioEstimado: Number(importeTotal),
        estadoGuiso: platoConfirmado ? 'confirmado' : 'buscando_minimo',
        suscribirNewsletter: true,
        html: htmlContent
      })
    });

    if (responseEndpoint.ok) {
      return {
        enviado: true,
        newsletterGuardada,
        detalle: 'Email enviado correctamente vía endpoint de notificaciones.'
      };
    }
  } catch {
    // Continuar al intento directo con Resend API si existe VITE_RESEND_API_KEY
  }

  if (RESEND_API_KEY) {
    try {
      const resDirect = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Nexus Café Bar <reservas@nexusgamingcenter.es>',
          to: [emailDestino],
          subject: asunto,
          html: htmlContent
        })
      });

      if (resDirect.ok) {
        return {
          enviado: true,
          newsletterGuardada,
          detalle: 'Email enviado mediante Resend API.'
        };
      }
    } catch {
      // Ignorar fallo de red/CORS en cliente
    }
  }

  return {
    enviado: false,
    newsletterGuardada,
    detalle: 'Reserva y suscripción guardadas (servicio de correo en espera de clave activa).'
  };
};
