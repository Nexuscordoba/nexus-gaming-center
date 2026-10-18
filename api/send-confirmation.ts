import { Resend } from 'resend';

declare const process: { env: { [key: string]: string | undefined } };

const apiKey = process.env.RESEND_API_KEY || '';
const resend = new Resend(apiKey);

export default async function handler(req: any, res: any) {
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
    return res.status(500).json({ error: 'Falta configurar RESEND_API_KEY en Vercel' });
  }

  const { 
    email, 
    nombre, 
    telefono,
    modalidad, 
    fechaEvento, 
    horaPreferente, 
    tematica, 
    numSesiones, 
    personas, 
    precioEstimado, 
    lugar,
    observaciones
  } = req.body;

  const emailEmpresa = process.env.NEXUS_ALERT_EMAIL || 'nexuscordoba26@gmail.com';
  const remitente = process.env.RESEND_FROM_EMAIL || 'Nexus Escape Lab <reservas@nexusgamingcenter.es>';

  try {
    // 1. Email al cliente (Confirmación)
    await resend.emails.send({
      from: remitente,
      to: [email],
      replyTo: emailEmpresa,
      subject: 'Reserva Confirmada · Nexus Escape Lab',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #06070a; color: #f1f5f9; padding: 30px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b;">
          <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
            <h1 style="color: #00f2fe; margin: 0; font-size: 24px;">NEXUS ESCAPE LAB</h1>
            <p style="color: #94a3b8; font-size: 13px; margin: 5px 0 0 0;">Polígono Chinales 45, Córdoba</p>
          </div>

          <div style="padding: 25px 0;">
            <p style="font-size: 16px; line-height: 1.5;">Hola <strong>${nombre}</strong>,</p>
            <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
              ¡Tu sesión de Escape Room ha quedado <strong>confirmada</strong>! Nuestro equipo ya tiene asignada la fecha y el monitor preparará el material.
            </p>

            <div style="background-color: #0d0f17; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #38bdf8; font-size: 15px; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
                Resumen de la Reserva
              </h3>
              <table style="width: 100%; font-size: 13px; color: #e2e8f0; line-height: 1.8;">
                <tr><td style="color: #94a3b8; width: 40%;">Modalidad:</td><td><strong>${modalidad.toUpperCase()}</strong></td></tr>
                <tr><td style="color: #94a3b8;">Fecha:</td><td><strong>${fechaEvento}</strong></td></tr>
                <tr><td style="color: #94a3b8;">Hora de inicio:</td><td><strong>${horaPreferente}</strong></td></tr>
                ${tematica ? `<tr><td style="color: #94a3b8;">Temática:</td><td style="text-transform: capitalize;"><strong>${tematica.replace('_', ' ')}</strong></td></tr>` : ''}
                <tr><td style="color: #94a3b8;">Jugadores / Duración:</td><td><strong>${personas} personas (${numSesiones} hora/s)</strong></td></tr>
                <tr><td style="color: #94a3b8;">Ubicación:</td><td><strong>${lugar}</strong></td></tr>
                <tr style="border-top: 1px solid #334155;">
                  <td style="color: #00f2fe; padding-top: 10px; font-weight: bold;">Precio total:</td>
                  <td style="color: #00f2fe; padding-top: 10px; font-size: 16px; font-weight: bold;">${precioEstimado} €</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
              El monitor llegará con 15 minutos de antelación para el montaje del atrezzo y las cajas. Si necesitas cualquier ajuste, puedes responder directamente a este correo o escribirnos al WhatsApp de Nexus.
            </p>
          </div>

          <div style="border-top: 1px solid #1e293b; padding-top: 20px; text-align: center; font-size: 12px; color: #64748b;">
            <p style="margin: 0;">NEXUS CÓRDOBA SL · Chinales 45, Córdoba</p>
          </div>
        </div>
      `,
    });

    // 2. Email de alerta a la empresa (Nexus)
    await resend.emails.send({
      from: remitente,
      to: [emailEmpresa],
      subject: `🚨 NUEVA RESERVA ESCAPE ROOM: ${fechaEvento} (${nombre})`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0284c7; margin-top: 0;">Nueva Reserva Confirmada de Escape Room</h2>
          <p>Se ha registrado y confirmado una nueva salida en el sistema:</p>
          <ul>
            <li><strong>Cliente:</strong> ${nombre}</li>
            <li><strong>Teléfono:</strong> <a href="tel:${telefono}">${telefono}</a></li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Modalidad:</strong> ${modalidad}</li>
            <li><strong>Fecha:</strong> ${fechaEvento} a las ${horaPreferente}</li>
            <li><strong>Lugar:</strong> ${lugar} (<a href="https://maps.google.com/?q=${encodeURIComponent(lugar)}" target="_blank">Ver ruta en Google Maps</a>)</li>
            <li><strong>Temática:</strong> ${tematica || 'No especificada'}</li>
            <li><strong>Sesiones / Jugadores:</strong> ${numSesiones} sesión/es · ${personas} jugadores</li>
            <li><strong>Precio fijado:</strong> ${precioEstimado} €</li>
            <li><strong>Observaciones:</strong> ${observaciones || 'Ninguna'}</li>
          </ul>
          <p>Esta reserva ya está visible en el <a href="https://equipo.nexusgamingcenter.es">Portal de Personal / Salidas</a>.</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error al enviar emails con Resend:', error);
    return res.status(500).json({ error: error.message || 'Error en Resend' });
  }
}