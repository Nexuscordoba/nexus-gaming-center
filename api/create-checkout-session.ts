import Stripe from 'stripe';

declare const process: { env: { [key: string]: string | undefined } };

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = new Stripe(stripeSecretKey);

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
    return res.status(500).json({ error: 'Falta configurar STRIPE_SECRET_KEY en Vercel' });
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
              name: `Reserva Escape Room (${modalidad.toUpperCase()})`,
              description: `Fecha: ${fechaEvento} a las ${horaPreferente} · Nexus Escape Lab`,
            },
            unit_amount: Math.round(precioTotal * 100), // Stripe trabaja en céntimos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}?pago=exito&reserva_id=${reservaId}`,
      cancel_url: `${origin}?pago=cancelado`,
      metadata: {
        linea_negocio: 'ESCAPE_ROOM', // Diferenciador clave frente a 'ENTRADAS_CARD_SHOW'
        reserva_id: reservaId,
        cliente_nombre: nombre,
        fecha_evento: fechaEvento,
        hora_preferente: horaPreferente,
        modalidad: modalidad
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Error al generar sesión de Stripe:', error);
    return res.status(500).json({ error: error.message || 'Error al conectar con Stripe' });
  }
}