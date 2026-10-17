import { Resend } from 'resend';

const getEnv = (key: string): string => {
  return (globalThis as any).process?.env?.[key] || '';
};

const resend = new Resend(getEnv('RESEND_API_KEY'));

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { 
    email, 
    nombre, 
    modalidad, 
    fechaEvento, 
    horaPreferente, 
    tematica, 
    numSesiones, 
    personas, 
    precioEstimado, 
    lugar 
  } = req.body;

  try {
    const data = await resend.emails.send({
      from: 'Nexus Escape Lab <reservas@nexusgamingcenter.es>',
      to: [email],
      replyTo: 'info@nexusgamingcenter.es',
      subject: 'Confirmación de solicitud de reserva · Nexus Escape Lab',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #06070a; color: #f1f5f9; padding: 30px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b;">
          <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
            <h1 style="color: #00f2fe; margin: 0; font-size: 24px;">NEXUS ESCAPE LAB</h1>
            <p style="color: #94a3b8; font-size: 13px; margin: 5px 0 0 0;">Polígono Chinales 45, Córdoba</p>
          </div>

          <div style="padding: 25px 0;">
            <p style="font-size: 16px; line-height: 1.5;">Hola <strong>${nombre}</strong>,</p>
            <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
              Hemos recibido correctamente tu solicitud de reserva para Nexus Escape Lab. Nuestro equipo revisará la agenda para confirmar la disponibilidad y formalizar la sesión.
            </p>

            <div style="background-color: #0d0f17; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #38bdf8; font-size: 15px; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
                Detalles de tu Solicitud
              </h3>
              <table style="width: 100%; font-size: 13px; color: #e2e8f0; line-height: 1.8;">
                <tr>
                  <td style="color: #94a3b8; width: 40%;">Modalidad:</td>
                  <td><strong>${modalidad.toUpperCase()}</strong></td>
                </tr>
                <tr>
                  <td style="color: #94a3b8;">Fecha solicitada:</td>
                  <td><strong>${fechaEvento}</strong></td>
                </tr>
                <tr>
                  <td style="color: #94a3b8;">Hora preferente:</td>
                  <td><strong>${horaPreferente}</strong></td>
                </tr>
                ${tematica ? `
                <tr>
                  <td style="color: #94a3b8;">Temática:</td>
                  <td style="text-transform: capitalize;"><strong>${tematica.replace('_', ' ')}</strong></td>
                </tr>` : ''}
                <tr>
                  <td style="color: #94a3b8;">Asistentes / Pases:</td>
                  <td><strong>${personas} personas (${numSesiones} ${numSesiones === 1 ? 'hora' : 'horas'})</strong></td>
                </tr>
                ${lugar ? `
                <tr>
                  <td style="color: #94a3b8;">Ubicación:</td>
                  <td><strong>${lugar}</strong></td>
                </tr>` : ''}
                <tr style="border-top: 1px solid #334155;">
                  <td style="color: #00f2fe; padding-top: 10px; font-weight: bold;">Presupuesto estimado:</td>
                  <td style="color: #00f2fe; padding-top: 10px; font-size: 16px; font-weight: bold;">${precioEstimado} €</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
              📌 <em>Nota importante:</em> Esta solicitud queda pendiente de confirmación formal por nuestro equipo. Te contactaremos por teléfono o WhatsApp para coordinar los detalles.
            </p>
          </div>

          <div style="border-top: 1px solid #1e293b; padding-top: 20px; text-align: center; font-size: 12px; color: #64748b;">
            <p style="margin: 0;">NEXUS CÓRDOBA SL · Polígono Chinales 45, Córdoba</p>
            <p style="margin: 4px 0 0 0;">Si tienes dudas puedes responder directamente a este correo.</p>
          </div>
        </div>
      `,
    });

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}