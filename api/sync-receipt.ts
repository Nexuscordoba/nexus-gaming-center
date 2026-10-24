// api/sync-receipt.ts
declare var process: any;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Corregido: Ahora coincide exactamente con el nombre de tu variable en Vercel
  const token = process.env.LOYVERSE_API_KEY; 
  if (!token) {
    return res.status(500).json({ error: 'No token' });
  }

  try {
    const { receipt_number, total_money, payment_type, items } = req.body;

    // 1. Obtener los IDs reales de pago de TU cuenta de Loyverse
    const payRes = await fetch('https://api.loyverse.com/v1.0/payment_types', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const payData = await payRes.json();
    
    // Buscar si es efectivo o tarjeta en tus configuraciones
    let paymentTypeId = payData.payment_types?.[0]?.id; // Por defecto el primero
    const tipoBuscado = payment_type === 'efectivo' ? 'CASH' : 'CARD';
    const tipoEncontrado = payData.payment_types?.find((p: any) => p.type === tipoBuscado);
    if (tipoEncontrado) paymentTypeId = tipoEncontrado.id;

    // 2. Formatear items limpios
    const line_items = items.map((item: any) => ({
      variant_id: item.loyverse_variant_id || "", 
      quantity: item.cantidad,
      price: item.precio,
      total_money: item.precio * item.cantidad
    }));

    // 3. Construir payload
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
              payment_type_id: paymentTypeId, 
              money_amount: total_money
            }
          ]
        }
      ]
    };

    const response = await fetch('https://api.loyverse.com/v1.0/receipts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.errors?.[0]?.details || 'Error Loyverse');

    return res.status(200).json({ success: true, loyverse_response: data });
  } catch (error: any) {
    console.error("Error en sync-receipt:", error);
    return res.status(500).json({ error: error.message });
  }
}