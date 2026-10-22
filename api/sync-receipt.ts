// api/sync-receipt.ts
declare var process: any; // <-- Esto soluciona el error de TypeScript

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Tu token de Loyverse (asegúrate de tenerlo en las variables de entorno de Vercel como LOYVERSE_ACCESS_TOKEN)
  const token = process.env.LOYVERSE_ACCESS_TOKEN; 
  if (!token) {
    return res.status(500).json({ error: 'No se encontró el token de Loyverse' });
  }

  try {
    const { receipt_number, total_money, payment_type, items } = req.body;

    // Formatear las líneas de pedido al estándar de Loyverse
    const line_items = items.map((item: any) => ({
      variant_id: item.loyverse_variant_id || "", // El ID que guardamos en Supabase
      quantity: item.cantidad,
      price: item.precio,
      total_money: item.precio * item.cantidad
    }));

    // Construir el recibo para Loyverse
    const payload = {
      receipts: [
        {
          receipt_number: `NEXUS-${receipt_number}`,
          receipt_date: new Date().toISOString(),
          receipt_type: "SALE",
          total_money: total_money,
          total_discount: 0,
          line_items: line_items,
          payments: [
            {
              payment_type_id: payment_type === 'efectivo' ? 'CASH' : 'CARD', 
              money_amount: total_money
            }
          ]
        }
      ]
    };

    // Enviar a Loyverse
    const response = await fetch('https://api.loyverse.com/v1.0/receipts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.details || 'Error al enviar a Loyverse');
    }

    return res.status(200).json({ success: true, loyverse_response: data });
  } catch (error: any) {
    console.error("Error en sync-receipt:", error);
    return res.status(500).json({ error: error.message });
  }
}