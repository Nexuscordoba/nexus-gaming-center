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
    tipo = 'reserva_en_cola', // 'reserva_en_cola' | 'plato_confirmado_pago' | 'plato_cancelado_plan_b'
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
    telefonoWhatsAppBar = '34624454242',
    platosAlternativos = []
  } = req.body || {};

  const emailDestino = String(email || '').trim().toLowerCase();
  if (!emailDestino || !emailDestino.includes('@')) {
    return res.status(400).json({ error: 'Correo electrónico no válido o ausente' });
  }

  const emailEmpresa = process.env.NEXUS_ALERT_EMAIL || 'nexuscordoba26@gmail.com';
  const remitente =
    process.env.RESEND_FROM_EMAIL || 'Nexus Guisos <reservas@nexusgamingcenter.es>';

  const modalidadTexto =
    modalidad === 'takeaway' ? '🛍️ Para llevar / Takeaway' : '🪑 Comer en el local (Sala/Terraza)';
  const fechaTexto = fechaHumana || fecha || 'próximamente';
  const importeFormateado = Number(totalImporte || 0).toFixed(2);
  const waNumeroLimpio = String(telefonoWhatsAppBar || '').replace(/\D+/g, '') || '34624454242';

  let asunto = '';
  let htmlContent = '';

  // 1. RESERVA EN COLA (BUSCANDO MÍNIMO)
  if (tipo === 'reserva_en_cola') {
    asunto = `🍲 Reserva Registrada: ${plato} (${fechaTexto}) · Café Bar Nexus`;
    htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050609; color: #f1f5f9; padding: 32px 20px; max-width: 600px; margin: 0 auto; border-radius: 20px; border: 1px solid #1e293b;">
        <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
          <span style="font-size: 32px;">🍲</span>
          <h1 style="color: #00f2fe; margin: 6px 0 0 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">CAFÉ BAR NEXUS</h1>
          <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">Polígono Chinales 45, Córdoba · Guisos Caseros Bajo Demanda</p>
        </div>

        <div style="padding: 24px 0;">
          <p style="font-size: 16px; margin: 0 0 12px 0;">Hola <strong>${nombre}</strong> 👋,</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 18px 0;">
            Hemos registrado tu reserva para el guiso del día. Tu plaza está guardada en nuestra preventa.
          </p>

          <!-- AVISO IMPORTANTE: NO PAGAR AÚN -->
          <div style="background-color: #1e1b4b; border: 1px solid #6366f1; border-radius: 14px; padding: 16px; margin: 18px 0;">
            <p style="color: #a5b4fc; font-size: 13px; font-weight: bold; margin: 0 0 4px 0;">
              ⏳ FASE DE PREVENTA: NO DEBES PAGAR NADA TODAVÍA
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
            Si necesitas modificar o cancelar tus raciones antes del corte, puedes avisarnos por WhatsApp al <a href="https://wa.me/${waNumeroLimpio}" style="color: #38bdf8; text-decoration: underline;">${waNumeroLimpio}</a>.
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
    asunto = `🟢 ¡Fogones Confirmados! Abono de tu reserva: ${plato} (${fechaTexto}) · Café Bar Nexus`;
    const waMensajeJustificante = encodeURIComponent(
      `¡Hola equipo de Nexus! 👋 Envío el justificante de pago para mi reserva del guiso "${plato}" (${fechaTexto}) a nombre de ${nombre} (${raciones} raciones · ${importeFormateado} €).`
    );
    const linkWhatsAppJustificante = `https://wa.me/${waNumeroLimpio}?text=${waMensajeJustificante}`;

    htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050609; color: #f1f5f9; padding: 32px 20px; max-width: 600px; margin: 0 auto; border-radius: 20px; border: 1px solid #10b981;">
        <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
          <span style="font-size: 36px;">🔥🍲</span>
          <h1 style="color: #10b981; margin: 6px 0 0 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">¡FOGONES CONFIRMADOS!</h1>
          <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0 0 0;">Café Bar Nexus · Chinales 45, Córdoba</p>
        </div>

        <div style="padding: 24px 0;">
          <p style="font-size: 16px; margin: 0 0 12px 0;">¡Buenas noticias, <strong>${nombre}</strong>! 🎉</p>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 18px 0;">
            El guiso <strong>${plato}</strong> para el <strong>${fechaTexto}</strong> ya ha alcanzado el mínimo requerido y está <strong>oficialmente confirmado</strong> en nuestra cocina.
          </p>

          <!-- CAJA DESTACADA DE PAGO -->
          <div style="background: linear-gradient(145deg, #062817 0%, #081a12 100%); border: 1.5px solid #10b981; border-radius: 16px; padding: 22px; margin: 22px 0; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.15);">
            <div style="text-align: center; margin-bottom: 16px;">
              <span style="color: #6ee7b7; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Total a abonar</span>
              <div style="color: #ffffff; font-size: 32px; font-weight: 900; margin-top: 2px;">${importeFormateado} €</div>
              <p style="color: #a7f3d0; font-size: 12px; margin: 4px 0 0 0;">(${raciones} ${raciones === 1 ? 'ración' : 'raciones'} · ${modalidadTexto})</p>
            </div>

            <div style="background-color: rgba(0, 0, 0, 0.4); border-radius: 12px; padding: 14px; margin-bottom: 16px; font-size: 13px; line-height: 1.6;">
              <p style="margin: 0 0 8px 0; color: #f1f5f9;"><strong>Instrucciones de Abono:</strong></p>
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
                📲 Enviar Justificante por WhatsApp
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
        </div>

        <div style="border-top: 1px solid #1e293b; padding-top: 18px; text-align: center;">
          <p style="color: #64748b; font-size: 11px; margin: 0;">Café Bar Nexus · Chinales 45, Córdoba · <a href="https://www.nexusgamingcenter.es/#guisos" style="color: #38bdf8;">nexusgamingcenter.es/#guisos</a></p>
        </div>
      </div>
    `;
  }

  // 3. PLATO CANCELADO (PLAN B INTELIGENTE)
  else if (tipo === 'plato_cancelado_plan_b') {
    asunto = `🍲 Actualización del Guiso: ${plato} (${fechaTexto}) · Café Bar Nexus`;
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
          <span style="font-size: 32px;">🍲</span>
          <h1 style="color: #fb7185; margin: 6px 0 0 0; font-size: 20px; font-weight: 900;">CAFÉ BAR NEXUS</h1>
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
              🍔 Ver Carta Completa de Café Bar
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

  try {
    const data = await resend.emails.send({
      from: remitente,
      to: [emailDestino],
      replyTo: emailEmpresa,
      subject: asunto,
      html: htmlContent
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
