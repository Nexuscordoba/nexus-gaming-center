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
    console.warn('Falta configurar RESEND_API_KEY en variables de entorno de Vercel');
    return res.status(500).json({ error: 'Falta configurar RESEND_API_KEY en Vercel' });
  }

  const { email, ticket, configFiscal } = req.body;

  if (!email || !ticket) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (email, ticket)' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email).trim())) {
    return res.status(400).json({ error: 'El formato de correo electrónico no es válido' });
  }

  const fiscal = configFiscal || {
    razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.',
    nombre_comercial: 'NEXUS GAMING CENTER & CAFETERÍA',
    nif_cif: 'B00000000',
    direccion_fiscal: 'Polígono Chinales 45, Córdoba',
    telefono: '624 45 42 42'
  };

  const remitente = process.env.RESEND_FROM_EMAIL || 'Nexus Cafetería <recibos@nexusgamingcenter.es>';
  const replyTo = process.env.NEXUS_ALERT_EMAIL || 'nexuscordoba26@gmail.com';

  const fechaFormateada = ticket.fecha_expedicion
    ? new Date(ticket.fecha_expedicion).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleString('es-ES');

  const lineasHtml = (ticket.lineas || [])
    .map(
      (l: any) => `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 10px 8px; font-size: 13px; color: #f1f5f9;">
          <strong>${l.nombre || 'Artículo'}</strong>
        </td>
        <td style="padding: 10px 8px; font-size: 13px; color: #94a3b8; text-align: center;">
          ${l.cantidad || 1}
        </td>
        <td style="padding: 10px 8px; font-size: 13px; color: #94a3b8; text-align: right;">
          ${Number(l.precio_unitario || l.precio || 0).toFixed(2)} €
        </td>
        <td style="padding: 10px 8px; font-size: 13px; color: #00f2fe; text-align: right; font-weight: bold;">
          ${Number(l.subtotal_linea || (l.precio || 0) * (l.cantidad || 1)).toFixed(2)} €
        </td>
      </tr>
    `
    )
    .join('');

  const totalNum = Number(ticket.total_final || ticket.total || 0);
  const base10 = Number(ticket.base_imponible_10 || 0);
  const iva10 = Number(ticket.iva_10 || 0);
  const base21 = Number(ticket.base_imponible_21 || 0);
  const iva21 = Number(ticket.iva_21 || 0);
  const totalBase = base10 + base21 > 0 ? (base10 + base21) : Number(ticket.base_imponible || (totalNum / 1.1));
  const totalIva = iva10 + iva21 > 0 ? (iva10 + iva21) : Number(ticket.cuota_iva || (totalNum - totalBase));

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Recibo / Ticket ${ticket.numero_completo || ''}</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #06070a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6);">
          
          <!-- Encabezado Nexus -->
          <div style="background: linear-gradient(135deg, #0b0f19 0%, #082f49 100%); padding: 28px 24px; text-align: center; border-bottom: 1px solid rgba(0, 242, 254, 0.2);">
            <div style="display: inline-block; background-color: rgba(0, 242, 254, 0.1); border: 1px solid rgba(0, 242, 254, 0.4); padding: 4px 14px; border-radius: 999px; margin-bottom: 10px;">
              <span style="color: #00f2fe; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Nexus Gaming Center & Cafetería</span>
            </div>
            <h1 style="margin: 6px 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">TICKET SIMPLIFICADO DE COMPRA</h1>
            <p style="margin: 0; color: #94a3b8; font-size: 12px;">Comprobante de consumo legal</p>
          </div>

          <!-- Datos de Empresa y Ticket -->
          <div style="padding: 24px; border-bottom: 1px solid #1e293b; background-color: #0d1322;">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <div>
                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #ffffff;">${fiscal.razon_social}</p>
                <p style="margin: 2px 0; font-size: 11px; color: #94a3b8;">NIF/CIF: <strong style="color: #cbd5e1;">${fiscal.nif_cif}</strong></p>
                <p style="margin: 2px 0; font-size: 11px; color: #94a3b8;">${fiscal.direccion_fiscal}</p>
                ${fiscal.telefono ? `<p style="margin: 2px 0; font-size: 11px; color: #94a3b8;">Tel: ${fiscal.telefono}</p>` : ''}
              </div>
              <div style="text-align: right;">
                <p style="margin: 0; font-size: 13px; font-weight: 900; color: #00f2fe; font-family: monospace;">${ticket.numero_completo || 'TICKET'}</p>
                <p style="margin: 2px 0; font-size: 11px; color: #cbd5e1;">${fechaFormateada}</p>
                ${ticket.mesa ? `<p style="margin: 2px 0; font-size: 11px; color: #94a3b8;">Ubicación: <strong style="color: #ffffff;">${ticket.mesa}</strong></p>` : ''}
                ${ticket.metodo_pago ? `<p style="margin: 2px 0; font-size: 11px; color: #94a3b8;">Pago: <strong style="text-transform: uppercase; color: #38bdf8;">${ticket.metodo_pago}</strong></p>` : ''}
              </div>
            </div>
          </div>

          <!-- Desglose de Artículos -->
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="border-bottom: 2px solid #334155;">
                  <th style="padding: 8px; text-align: left; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Artículo</th>
                  <th style="padding: 8px; text-align: center; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Uds</th>
                  <th style="padding: 8px; text-align: right; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Precio</th>
                  <th style="padding: 8px; text-align: right; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${lineasHtml}
              </tbody>
            </table>

            <!-- Desglose Fiscal e Impuestos -->
            <div style="background-color: #060910; border: 1px solid #1e293b; border-radius: 14px; padding: 16px; margin-bottom: 20px;">
              ${base10 > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 4px;">
                  <span>Base Imponible Hostelería (10%):</span>
                  <span style="font-family: monospace; color: #e2e8f0;">${base10.toFixed(2)} €</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">
                  <span>Cuota IVA (10%):</span>
                  <span style="font-family: monospace; color: #e2e8f0;">${iva10.toFixed(2)} €</span>
                </div>
              ` : ''}

              ${base21 > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 4px;">
                  <span>Base Imponible General (21%):</span>
                  <span style="font-family: monospace; color: #e2e8f0;">${base21.toFixed(2)} €</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">
                  <span>Cuota IVA (21%):</span>
                  <span style="font-family: monospace; color: #e2e8f0;">${iva21.toFixed(2)} €</span>
                </div>
              ` : ''}

              ${base10 === 0 && base21 === 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 4px;">
                  <span>Base Imponible Total:</span>
                  <span style="font-family: monospace; color: #e2e8f0;">${totalBase.toFixed(2)} €</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">
                  <span>Cuota IVA Total:</span>
                  <span style="font-family: monospace; color: #e2e8f0;">${totalIva.toFixed(2)} €</span>
                </div>
              ` : ''}

              <div style="border-top: 1px solid #334155; margin-top: 8px; padding-top: 10px; display: flex; justify-content: space-between; align-items: baseline;">
                <span style="font-size: 15px; font-weight: 900; color: #ffffff; text-transform: uppercase;">TOTAL PAGADO:</span>
                <span style="font-size: 22px; font-weight: 900; color: #00f2fe; font-family: monospace;">${totalNum.toFixed(2)} €</span>
              </div>
            </div>

            <!-- Huella VeriFactu -->
            ${ticket.hash_actual ? `
              <div style="text-align: center; margin-bottom: 16px;">
                <p style="margin: 0; font-size: 10px; color: #64748b; font-family: monospace; word-break: break-all;">
                  Huella Digital VeriFactu (Ley 11/2021):<br/>
                  ${ticket.hash_actual}
                </p>
              </div>
            ` : ''}

            <!-- Pie de mensaje -->
            <div style="text-align: center; border-top: 1px solid #1e293b; padding-top: 18px;">
              <p style="margin: 0; font-size: 13px; font-weight: bold; color: #38bdf8;">¡Gracias por tu visita a Nexus Gaming Center!</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">
                Cafetería de Especialidad · Escape Rooms · Zona Gaming · Eventos<br/>
                Polígono Chinales 45, Córdoba · nexusgamingcenter.es
              </p>
            </div>
          </div>

        </div>
      </body>
    </html>
  `;

  try {
    const data = await resend.emails.send({
      from: remitente,
      to: [email.trim()],
      replyTo,
      subject: `Tu Ticket de Compra ${ticket.numero_completo || ''} · Nexus Gaming Center`,
      html
    });

    return res.status(200).json({ success: true, message: 'Ticket enviado correctamente', data });
  } catch (error: any) {
    console.error('Error al enviar ticket con Resend:', error);
    return res.status(500).json({ error: error.message || 'Error al enviar ticket con Resend' });
  }
}
