// @ts-nocheck
import Stripe from 'stripe';

const stripeSecretKey = (globalThis as any).process?.env?.STRIPE_SECRET_KEY || '';

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16'
});

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

  if (!stripeSecretKey) {
    return res.status(500).json({ error: 'Falta configurar STRIPE_SECRET_KEY en las variables de entorno de Vercel' });
  }

  const { 
    reservaId,
    nombre, 
    email, 
    modalidad, 
    fechaEvento, 
    horaPreferente, 
    precioTotal 
  } = req.body;

  try {
    const origin = req.headers.origin || 'https://escape.nexusgamingcenter.es';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Reserva Escape Room (${String(modalidad || '').toUpperCase()})`,
              description: `Fecha: ${fechaEvento} a las ${horaPreferente} · Nexus Escape Lab`,
            },
            unit_amount: Math.round(Number(precioTotal) * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}?pago=exito&reserva_id=${reservaId}`,
      cancel_url: `${origin}?pago=cancelado`,
      metadata: {
        linea_negocio: 'ESCAPE_ROOM',
        reserva_id: String(reservaId || ''),
        cliente_nombre: String(nombre || ''),
        fecha_evento: String(fechaEvento || ''),
        hora_preferente: String(horaPreferente || ''),
        modalidad: String(modalidad || '')
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Error al generar sesión de Stripe:', error);
    return res.status(500).json({ error: error.message || 'Error al conectar con Stripe' });
  }
}