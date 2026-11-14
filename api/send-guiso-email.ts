import { Resend } from 'resend';

declare const process: { env: { [key: string]: string | undefined } };

const apiKey = process.env.RESEND_API_KEY || '';
const resend = new Resend(apiKey);

export default async function handler(req: any, res: any) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!apiKey) {
    console.warn('Falta configurar RESEND_API_KEY en variables de entorno de Vercel');
    return res.status(500).json({ error: 'Falta configurar RESEND_API_KEY en Vercel' });
  }

  const {
    tipo = 'reserva_en_cola', // 'reserva_en_cola' | 'plato_confirmado_pago' | 'plato_cancelado_plan_b' | 'reserva_cancelada' | 'plato_cambiado'
    email,
    nombre,
    telefono,
    plato,
    fecha,
    fechaHumana,
    horaServicio,
    modalidad = 'barra', // 'barra' | 'takeaway'
    raciones = 1,
    totalImporte = 0,
    zonaMesa = '',
    numeroBizum = '624 45 42 42',
    enlacePago = 'https://www.nexusgamingcenter.es/#guisos',
    instruccionesPago = '',
    fechaCorteHumana = '',
    horaLimiteHumana = '',
    enlaceGestion = '',
    telefonoWhatsAppBar = '34624454242',
    platosAlternativos = []
  } = req.body || {};

  const emailDestino = String(email || '').trim().toLowerCase();
  if (!emailDestino || !emailDestino.includes('@')) {
    return res.status(400).json({ error: 'Correo electrónico no válido o ausente' });
  }

  const emailEmpresa = process.env.NEXUS_ALERT_EMAIL || 'nexuscordoba26@gmail.com';
  // Remitente verificado en Resend para máxima reputación y entregabilidad a bandeja de entrada
  const remitente =
    process.env.RESEND_FROM_EMAIL || 'Nexus Centro <reservas@nexusgamingcenter.es>';

  const modalidadTexto =
    modalidad === 'takeaway' ? 'Para llevar / Takeaway' : 'En el local (Sala/Terraza)';
  const fechaTexto = fechaHumana || fecha || 'próximamente';
  const importeFormateado = Number(totalImporte || 0).toFixed(2);
  const waNumeroLimpio = String(telefonoWhatsAppBar || '').replace(/\D+/g, '') || '34624454242';

  let asunto = '';
  let htmlContent = '';
  let textContent = '';

  // 1. RESERVA EN COLA (BUSCANDO MÍNIMO)
  if (tipo === 'reserva_en_cola') {
    asunto = `Reserva registrada en Nexus: ${plato} (${fechaTexto})`;

    textContent = [
      `Hola ${nombre},`,
      ``,
      `Hemos registrado tu reserva para el guiso casero: ${plato}.`,
      `Tu plaza ha quedado guardada en nuestra preventa.`,
      ``,
      `IMPORTANTE - FASE DE PREVENTA: NO DEBES PAGAR NADA TODAVÍA.`,
      `Este plato necesita alcanzar un mínimo de raciones para encender los fogones. En cuanto alcancemos el objetivo te enviaremos la confirmación definitiva con los datos de abono.`,
      ``,
      `Detalles de tu reserva:`,
      `- Plato: ${plato}`,
      `- Día de servicio: ${fechaTexto}`,
      horaServicio ? `- Hora prevista: ${horaServicio}` : '',
      `- Raciones: ${raciones}`,
      `- Modalidad: ${modalidadTexto}`,
      zonaMesa ? `- Ubicación: ${zonaMesa}` : '',
      `- Importe previsto al confirmar: ${importeFormateado} €`,
      ``,
      `Si necesitas consultar o modificar tu reserva, puedes escribirnos por WhatsApp al ${waNumeroLimpio}.`,
      ``,
      `Café Bar Nexus · Polígono Chinales 45, Córdoba`,
      `https://www.nexusgamingcenter.es/#guisos`
    ].filter(Boolean).join('\n');

    htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050609; color: #f1f5f9; padding: 32px 20px; max-width: 600px; margin: 0 auto; border-radius: 20px; border: 1px solid #1e293b;">
        <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
          <h1 style="color: #00f2fe; margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">CAFÉ BAR NEXUS</h1>
          <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">Polígono Chinales 45, Córdoba · Guisos Caseros Bajo Demanda</p>
        </div>

        <div style="padding: 24px 0;">
          <p style="font-size: 16px; margin: 0 0 12px 0;">Hola <strong>${nombre}</strong>,</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 18px 0;">
            Hemos registrado tu reserva para el guiso del día. Tu plaza está guardada en nuestra preventa.
          </p>

          <!-- AVISO IMPORTANTE: NO PAGAR AÚN -->
          <div style="background-color: #1e1b4b; border: 1px solid #6366f1; border-radius: 14px; padding: 16px; margin: 18px 0;">
            <p style="color: #a5b4fc; font-size: 13px; font-weight: bold; margin: 0 0 4px 0;">
              Fase de Preventa: No debes pagar nada todavía
            </p>
            <p style="color: #e0e7ff; font-size: 13px; line-height: 1.5; margin: 0;">
              Este guiso necesita alcanzar un mínimo de raciones para encender los fogones. En cuanto alcancemos el objetivo te enviaremos un correo y WhatsApp con la confirmación y los datos de abono.
            </p>
          </div>

          <!-- RESUMEN DE RESERVA -->
          <div style="background-color: #0b0e17; border: 1px solid #334155; border-radius: 14px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #38bdf8; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 14px 0; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
              Detalles de tu Reserva
            </h3>
            <table style="width: 100%; font-size: 13px; color: #e2e8f0; line-height: 1.9;">
              <tr><td style="color: #94a3b8; width: 42%;">Plato:</td><td><strong style="color: #f8fafc;">${plato}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Día de servicio:</td><td><strong>${fechaTexto}</strong></td></tr>
              ${horaServicio ? `<tr><td style="color: #94a3b8;">Hora prevista:</td><td><strong>${horaServicio}</strong></td></tr>` : ''}
              <tr><td style="color: #94a3b8;">Raciones:</td><td><strong>${raciones} ${raciones === 1 ? 'ración' : 'raciones'}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Modalidad:</td><td><strong>${modalidadTexto}</strong></td></tr>
              ${zonaMesa ? `<tr><td style="color: #94a3b8;">Ubicación:</td><td><strong>${zonaMesa}</strong></td></tr>` : ''}
              <tr style="border-top: 1px solid #1e293b;">
                <td style="color: #00f2fe; padding-top: 10px; font-weight: bold;">Importe previsto:</td>
                <td style="color: #00f2fe; padding-top: 10px; font-size: 16px; font-weight: 900;">${importeFormateado} €</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 12px; color: #94a3b8; line-height: 1.6; margin: 20px 0 0 0;">
            Si necesitas modificar o cancelar tus raciones antes del corte, puedes gestionarlo directamente desde <a href="${enlaceGestion || 'https://www.nexusgamingcenter.es/#guisos'}" style="color: #38bdf8; text-decoration: underline;">tu enlace personal de reserva</a> o escribirnos por WhatsApp al <a href="https://wa.me/${waNumeroLimpio}" style="color: #38bdf8; text-decoration: underline;">${waNumeroLimpio}</a>.
          </p>
        </div>

        <div style="border-top: 1px solid #1e293b; padding-top: 18px; text-align: center;">
          <p style="color: #64748b; font-size: 11px; margin: 0;">Café Bar Nexus · Polígono Chinales 45, Córdoba · <a href="https://www.nexusgamingcenter.es/#guisos" style="color: #38bdf8;">nexusgamingcenter.es/#guisos</a></p>
        </div>
      </div>
    `;
  }

  // 2. PLATO CONFIRMADO (SOLICITUD DE PAGO / ABONO)
  else if (tipo === 'plato_confirmado_pago') {
    asunto = `Confirmacion de plato y datos de abono: ${plato} - Nexus`;

    const waMensajeJustificante = encodeURIComponent(
      `Hola equipo de Nexus. Envío el justificante de pago para mi reserva del guiso "${plato}" (${fechaTexto}) a nombre de ${nombre} (${raciones} raciones · ${importeFormateado} €).`
    );
    const linkWhatsAppJustificante = `https://wa.me/${waNumeroLimpio}?text=${waMensajeJustificante}`;

    textContent = [
      `Hola ${nombre},`,
      ``,
      `Buenas noticias: el guiso "${plato}" para el ${fechaTexto} ya ha alcanzado el mínimo requerido y está oficialmente confirmado en nuestros fogones.`,
      ``,
      horaLimiteHumana
        ? `IMPORTANTE - PLAZO LÍMITE: Tienes hasta las ${horaLimiteHumana} para abonar tu reserva (Bizum o Tarjeta). Si no se abona antes de esa hora, la reserva y tu mesa se liberarán automáticamente.\n`
        : '',
      `Resumen de tu reserva:`,
      `- Plato: ${plato}`,
      `- Día: ${fechaTexto}`,
      horaServicio ? `- Hora: ${horaServicio}` : '',
      `- Raciones: ${raciones} (${modalidadTexto})`,
      zonaMesa ? `- Mesa / Destino: ${zonaMesa}` : '',
      `- TOTAL A ABONAR: ${importeFormateado} €`,
      ``,
      `Instrucciones de Pago:`,
      `- Bizum al teléfono: ${numeroBizum}`,
      `- Concepto: GUISO ${String(nombre).toUpperCase().slice(0, 15)}`,
      horaLimiteHumana ? `- Plazo para abonar: Hasta las ${horaLimiteHumana}` : (fechaCorteHumana ? `- Fecha límite: ${fechaCorteHumana}` : ''),
      instruccionesPago ? `- ${instruccionesPago}` : '',
      enlacePago ? `- O paga online con tarjeta: ${enlacePago}` : '',
      ``,
      `Por favor, envía tu justificante por WhatsApp al teléfono ${waNumeroLimpio} para dejar tu ración 100% asegurada.`,
      enlaceGestion ? `\nPara cambiar de guiso o cancelar tu reserva: ${enlaceGestion}` : '',
      ``,
      `Café Bar Nexus · Polígono Chinales 45, Córdoba`,
      `https://www.nexusgamingcenter.es/#guisos`
    ].filter(Boolean).join('\n');

    htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050609; color: #f1f5f9; padding: 32px 20px; max-width: 600px; margin: 0 auto; border-radius: 20px; border: 1px solid #10b981;">
        <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
          <h1 style="color: #10b981; margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">FOGONES CONFIRMADOS</h1>
          <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0 0 0;">Café Bar Nexus · Chinales 45, Córdoba</p>
        </div>

        <div style="padding: 24px 0;">
          <p style="font-size: 16px; margin: 0 0 12px 0;">Buenas noticias, <strong>${nombre}</strong>,</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 18px 0;">
            El guiso <strong>${plato}</strong> para el <strong>${fechaTexto}</strong> ya ha alcanzado el mínimo requerido y está <strong>confirmado en cocina</strong>.
          </p>

          <!-- AVISO DE PLAZO LÍMITE DE PAGO -->
          ${horaLimiteHumana ? `
            <div style="background-color: #3b1405; border: 1.5px solid #f59e0b; border-radius: 14px; padding: 16px; margin: 18px 0; text-align: center;">
              <p style="color: #fde68a; font-size: 14px; font-weight: 900; margin: 0 0 6px 0;">
                ⏳ PLAZO DE PAGO: HASTA LAS ${horaLimiteHumana.toUpperCase()}
              </p>
              <p style="color: #fed7aa; font-size: 12px; margin: 0; line-height: 1.5;">
                Tienes hasta las <strong>${horaLimiteHumana}</strong> para abonar tu reserva. Pasada esa hora, la reserva y tu mesa se liberarán automáticamente.
              </p>
            </div>
          ` : ''}

          <!-- CAJA DESTACADA DE PAGO -->
          <div style="background: linear-gradient(145deg, #062817 0%, #081a12 100%); border: 1.5px solid #10b981; border-radius: 16px; padding: 22px; margin: 22px 0; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.15);">
            <div style="text-align: center; margin-bottom: 16px;">
              <span style="color: #6ee7b7; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Total a abonar</span>
              <div style="color: #ffffff; font-size: 32px; font-weight: 900; margin-top: 2px;">${importeFormateado} €</div>
              <p style="color: #a7f3d0; font-size: 12px; margin: 4px 0 0 0;">(${raciones} ${raciones === 1 ? 'ración' : 'raciones'} · ${modalidadTexto})</p>
            </div>

            <div style="background-color: rgba(0, 0, 0, 0.4); border-radius: 12px; padding: 14px; margin-bottom: 16px; font-size: 13px; line-height: 1.6;">
              <p style="margin: 0 0 8px 0; color: #f1f5f9;"><strong>Instrucciones de Pago:</strong></p>
              <ul style="margin: 0; padding-left: 20px; color: #e2e8f0;">
                <li><strong>Bizum al teléfono:</strong> <span style="color: #34d399; font-weight: 900; font-size: 15px;">${numeroBizum}</span></li>
                <li><strong>Concepto:</strong> <span style="font-family: monospace; color: #a7f3d0;">GUISO ${String(nombre).toUpperCase().slice(0, 15)}</span></li>
                ${fechaCorteHumana ? `<li><strong>Fecha límite de corte:</strong> <span style="color: #fcd34d;">${fechaCorteHumana}</span></li>` : ''}
              </ul>
              ${instruccionesPago ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #cbd5e1; border-top: 1px dashed #334155; padding-top: 6px;">${instruccionesPago}</p>` : ''}
            </div>

            <!-- BOTÓN WHATSAPP JUSTIFICANTE -->
            <div style="text-align: center; margin-top: 14px;">
              <a href="${linkWhatsAppJustificante}" style="display: inline-block; background-color: #25D366; color: #042f1a; font-weight: 900; font-size: 13px; padding: 12px 24px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 15px rgba(37, 211, 102, 0.4);">
                Enviar Justificante por WhatsApp
              </a>
              ${enlacePago ? `
                <div style="margin-top: 10px;">
                  <a href="${enlacePago}" style="color: #6ee7b7; font-size: 12px; text-decoration: underline;">O pagar mediante tarjeta / web</a>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- RESUMEN DE LA RESERVA -->
          <div style="background-color: #0b0e17; border: 1px solid #334155; border-radius: 14px; padding: 18px; margin: 18px 0;">
            <table style="width: 100%; font-size: 13px; color: #e2e8f0; line-height: 1.8;">
              <tr><td style="color: #94a3b8; width: 40%;">Plato:</td><td><strong>${plato}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Día de servicio:</td><td><strong>${fechaTexto}</strong></td></tr>
              ${horaServicio ? `<tr><td style="color: #94a3b8;">Hora de servicio:</td><td><strong>${horaServicio}</strong></td></tr>` : ''}
              ${zonaMesa ? `<tr><td style="color: #94a3b8;">Mesa / Destino:</td><td><strong>${zonaMesa}</strong></td></tr>` : ''}
            </table>
          </div>

          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 16px 0 0 0;">
            * Tu ración quedará 100% asegurada una vez recibido el abono o justificante antes de la hora de corte.
          </p>

          ${enlaceGestion ? `
            <div style="text-align: center; margin-top: 18px; padding-top: 14px; border-top: 1px dashed #334155;">
              <a href="${enlaceGestion}" style="color: #38bdf8; font-size: 12px; font-weight: bold; text-decoration: underline;">
                🔍 Gestionar mi reserva o cambiar de plato
              </a>
            </div>
          ` : ''}
        </div>

        <div style="border-top: 1px solid #1e293b; padding-top: 18px; text-align: center;">
          <p style="color: #64748b; font-size: 11px; margin: 0;">Café Bar Nexus · Chinales 45, Córdoba · <a href="https://www.nexusgamingcenter.es/#guisos" style="color: #38bdf8;">nexusgamingcenter.es/#guisos</a></p>
        </div>
      </div>
    `;
  }

  // 3. PLATO CANCELADO (PLAN B INTELIGENTE)
  else if (tipo === 'plato_cancelado_plan_b') {
    asunto = `Actualizacion sobre tu reserva de guiso: ${plato} - Nexus`;

    textContent = [
      `Hola ${nombre},`,
      ``,
      `Te escribimos para avisarte de que el guiso "${plato}" previsto para el ${fechaTexto} no ha alcanzado el mínimo de raciones necesario para cocinarlo en esta ocasión, por lo que hemos tenido que suspender su preparación.`,
      ``,
      Array.isArray(platosAlternativos) && platosAlternativos.length > 0
        ? `Otros guisos confirmados para esa fecha:\n${platosAlternativos.map((p: any) => `- ${p.nombre_plato || p}`).join('\n')}\n`
        : '',
      `Te esperamos igualmente en Café Bar Nexus con nuestra carta habitual de raciones, bocadillos y tapas en sala y terraza:`,
      `https://www.nexusgamingcenter.es/#bar`,
      ``,
      `Muchas gracias por tu confianza y comprensión.`,
      ``,
      `Café Bar Nexus · Polígono Chinales 45, Córdoba`
    ].filter(Boolean).join('\n');

    const alternativosHtml = Array.isArray(platosAlternativos) && platosAlternativos.length > 0
      ? `
        <div style="background-color: #0b0e17; border: 1px solid #334155; border-radius: 14px; padding: 18px; margin: 18px 0;">
          <h4 style="color: #fbbf24; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase;">
            Otros guisos confirmados para el ${fechaTexto}:
          </h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #e2e8f0; line-height: 1.8;">
            ${platosAlternativos.map((p: any) => `<li><strong>${p.nombre_plato || p}</strong></li>`).join('')}
          </ul>
        </div>
      `
      : '';

    htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050609; color: #f1f5f9; padding: 32px 20px; max-width: 600px; margin: 0 auto; border-radius: 20px; border: 1px solid #f43f5e;">
        <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
          <h1 style="color: #fb7185; margin: 0; font-size: 20px; font-weight: 900;">CAFÉ BAR NEXUS</h1>
          <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">Actualización de Guisos Bajo Demanda</p>
        </div>

        <div style="padding: 24px 0;">
          <p style="font-size: 16px; margin: 0 0 12px 0;">Hola <strong>${nombre}</strong>,</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px 0;">
            Te escribimos para avisarte de que el guiso <strong>${plato}</strong> previsto para el <strong>${fechaTexto}</strong> no ha alcanzado el mínimo de raciones necesario para cocinarlo en esta ocasión, por lo que hemos tenido que suspender su preparación.
          </p>

          ${alternativosHtml}

          <!-- BOTÓN A LA CARTA GENERAL -->
          <div style="background-color: #111827; border: 1px solid #374151; border-radius: 14px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="font-size: 14px; color: #f3f4f6; margin: 0 0 14px 0; font-weight: bold;">
              ¡Te esperamos igualmente con nuestra carta habitual!
            </p>
            <p style="font-size: 13px; color: #9ca3af; margin: 0 0 16px 0; line-height: 1.5;">
              Nuestras tapas caseras, bocadillos especiales, hamburguesas y raciones están listas para ti en sala y terraza.
            </p>
            <a href="https://www.nexusgamingcenter.es/#bar" style="display: inline-block; background-color: #00f2fe; color: #020617; font-weight: 900; font-size: 13px; padding: 12px 24px; border-radius: 12px; text-decoration: none;">
              Ver Carta Completa de Café Bar
            </a>
          </div>

          <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 16px 0 0 0;">
            ¡Muchas gracias por tu confianza y esperamos verte pronto por Chinales 45!
          </p>
        </div>

        <div style="border-top: 1px solid #1e293b; padding-top: 18px; text-align: center;">
          <p style="color: #64748b; font-size: 11px; margin: 0;">Café Bar Nexus · Chinales 45, Córdoba · <a href="https://www.nexusgamingcenter.es/#guisos" style="color: #38bdf8;">nexusgamingcenter.es/#guisos</a></p>
        </div>
      </div>
    `;
  }

  // 4. RESERVA CANCELADA
  else if (tipo === 'reserva_cancelada') {
    asunto = `Confirmación de cancelación de reserva: ${plato} - Nexus`;

    textContent = [
      `Hola ${nombre},`,
      ``,
      `Te confirmamos que tu reserva para el guiso "${plato}" (${fechaTexto}) de ${raciones} ${raciones === 1 ? 'ración' : 'raciones'} ha sido cancelada correctamente.`,
      ``,
      `Tanto tus raciones como tu mesa asignada han quedado liberadas en el sistema.`,
      ``,
      `Si deseas volver a reservar en cualquier momento u optar por otro plato de la semana, puedes hacerlo desde nuestra web:`,
      `https://www.nexusgamingcenter.es/#guisos`,
      ``,
      `O contactar directamente con nosotros por WhatsApp: ${waNumeroLimpio}.`,
      ``,
      `¡Esperamos recibirte pronto!`,
      `Café Bar Nexus · Polígono Chinales 45, Córdoba`
    ].filter(Boolean).join('\n');

    htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050609; color: #f1f5f9; padding: 32px 20px; max-width: 600px; margin: 0 auto; border-radius: 20px; border: 1px solid #475569;">
        <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
          <h1 style="color: #94a3b8; margin: 0; font-size: 20px; font-weight: 900;">CAFÉ BAR NEXUS</h1>
          <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Gestión de Reservas de Guisos Caseros</p>
        </div>

        <div style="padding: 24px 0;">
          <p style="font-size: 16px; margin: 0 0 12px 0;">Hola <strong>${nombre}</strong>,</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px 0;">
            Te confirmamos que tu reserva de <strong>${raciones} ${raciones === 1 ? 'ración' : 'raciones'}</strong> para el plato <strong>${plato}</strong> (${fechaTexto}) ha sido cancelada satisfactoriamente.
          </p>

          <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 14px; padding: 18px; margin: 18px 0;">
            <p style="font-size: 13px; color: #94a3b8; margin: 0; line-height: 1.5;">
              Tus plazas y tu mesa han quedado liberadas. No tienes ningún compromiso ni cargo pendiente.
            </p>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="https://www.nexusgamingcenter.es/#guisos" style="display: inline-block; background-color: #f59e0b; color: #020617; font-weight: 900; font-size: 13px; padding: 12px 24px; border-radius: 12px; text-decoration: none;">
              Ver Guisos Disponibles
            </a>
          </div>
        </div>

        <div style="border-top: 1px solid #1e293b; padding-top: 18px; text-align: center;">
          <p style="color: #64748b; font-size: 11px; margin: 0;">Café Bar Nexus · Chinales 45, Córdoba · <a href="https://www.nexusgamingcenter.es/#guisos" style="color: #38bdf8;">nexusgamingcenter.es/#guisos</a></p>
        </div>
      </div>
    `;
  }

  // 5. GUISO CAMBIADO POR EL CLIENTE
  else if (tipo === 'plato_cambiado') {
    asunto = `Actualización de reserva: Nuevo plato ${plato} - Nexus`;

    textContent = [
      `Hola ${nombre},`,
      ``,
      `Hemos actualizado tu reserva. Tu nuevo plato asignado es: ${plato} (${fechaTexto}).`,
      ``,
      `- Raciones: ${raciones} (${modalidadTexto})`,
      horaServicio ? `- Hora prevista: ${horaServicio}` : '',
      zonaMesa ? `- Mesa / Ubicación: ${zonaMesa}` : '',
      `- Total importe: ${importeFormateado} €`,
      ``,
      horaLimiteHumana ? `Plazo para abonar: Hasta las ${horaLimiteHumana}\n` : '',
      `Puedes consultar y gestionar tu reserva siempre que quieras en:`,
      `${enlaceGestion || 'https://www.nexusgamingcenter.es/#guisos'}`,
      ``,
      `Café Bar Nexus · Polígono Chinales 45, Córdoba`
    ].filter(Boolean).join('\n');

    htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050609; color: #f1f5f9; padding: 32px 20px; max-width: 600px; margin: 0 auto; border-radius: 20px; border: 1px solid #0284c7;">
        <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
          <h1 style="color: #38bdf8; margin: 0; font-size: 20px; font-weight: 900;">CAFÉ BAR NEXUS</h1>
          <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">Tu reserva ha sido cambiada con éxito</p>
        </div>

        <div style="padding: 24px 0;">
          <p style="font-size: 16px; margin: 0 0 12px 0;">Hola <strong>${nombre}</strong>,</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px 0;">
            Hemos registrado tu cambio de plato. Ahora disfrutarás de: <strong>${plato}</strong>.
          </p>

          <div style="background-color: #0b0e17; border: 1px solid #334155; border-radius: 14px; padding: 18px; margin: 18px 0;">
            <table style="width: 100%; font-size: 13px; color: #e2e8f0; line-height: 1.9;">
              <tr><td style="color: #94a3b8; width: 42%;">Nuevo plato:</td><td><strong style="color: #38bdf8;">${plato}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Día de servicio:</td><td><strong>${fechaTexto}</strong></td></tr>
              ${horaServicio ? `<tr><td style="color: #94a3b8;">Hora prevista:</td><td><strong>${horaServicio}</strong></td></tr>` : ''}
              <tr><td style="color: #94a3b8;">Raciones:</td><td><strong>${raciones}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Modalidad:</td><td><strong>${modalidadTexto}</strong></td></tr>
              ${zonaMesa ? `<tr><td style="color: #94a3b8;">Ubicación:</td><td><strong>${zonaMesa}</strong></td></tr>` : ''}
              <tr style="border-top: 1px solid #1e293b;">
                <td style="color: #38bdf8; padding-top: 10px; font-weight: bold;">Importe total:</td>
                <td style="color: #38bdf8; padding-top: 10px; font-size: 16px; font-weight: 900;">${importeFormateado} €</td>
              </tr>
            </table>
          </div>

          ${horaLimiteHumana ? `
            <div style="background-color: #451a03; border: 1px solid #f59e0b; border-radius: 12px; padding: 14px; margin: 16px 0; text-align: center;">
              <p style="color: #fde68a; font-size: 13px; font-weight: bold; margin: 0;">
                ⏳ Plazo para abonar: Tienes hasta las ${horaLimiteHumana}
              </p>
            </div>
          ` : ''}

          <div style="text-align: center; margin: 22px 0;">
            <a href="${enlaceGestion || 'https://www.nexusgamingcenter.es/#guisos'}" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: 900; font-size: 13px; padding: 12px 24px; border-radius: 12px; text-decoration: none;">
              Gestionar mi Reserva
            </a>
          </div>
        </div>

        <div style="border-top: 1px solid #1e293b; padding-top: 18px; text-align: center;">
          <p style="color: #64748b; font-size: 11px; margin: 0;">Café Bar Nexus · Chinales 45, Córdoba · <a href="https://www.nexusgamingcenter.es/#guisos" style="color: #38bdf8;">nexusgamingcenter.es/#guisos</a></p>
        </div>
      </div>
    `;
  }

  try {
    const data = await resend.emails.send({
      from: remitente,
      to: [emailDestino],
      replyTo: emailEmpresa,
      subject: asunto,
      html: htmlContent,
      text: textContent
    });

    return res.status(200).json({ ok: true, id: (data as any)?.id, tipo, email: emailDestino });
  } catch (error: any) {
    console.error('Error enviando email de guiso con Resend:', error);
    return res.status(500).json({
      error: 'Error al enviar el correo electrónico con Resend',
      detalle: error?.message || String(error)
    });
  }
}
