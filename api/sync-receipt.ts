// api/sync-receipt.ts
declare var process: any;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.LOYVERSE_API_KEY; 
  if (!token) {
    return res.status(500).json({ error: 'No token' });
  }

  try {
    const { receipt_number, total_money, payment_type, items } = req.body;

    // 1. Obtener el Store ID (Tienda) requerido por Loyverse
    const storeRes = await fetch('https://api.loyverse.com/v1.0/stores', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const storeData = await storeRes.json();
    const storeId = storeData.stores?.[0]?.id;
    
    if (!storeId) {
      throw new Error("No se pudo recuperar el ID de la tienda en Loyverse.");
    }

    // 2. Obtener los IDs de los métodos de pago
    const payRes = await fetch('https://api.loyverse.com/v1.0/payment_types', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const payData = await payRes.json();
    
    let paymentTypeId = payData.payment_types?.[0]?.id; 
    const tipoBuscado = payment_type === 'efectivo' ? 'CASH' : 'CARD';
    const tipoEncontrado = payData.payment_types?.find((p: any) => p.type === tipoBuscado);
    if (tipoEncontrado) paymentTypeId = tipoEncontrado.id;

    // 3. Formatear items protegiendo los que no tienen variant_id mapeado
    const line_items = items.map((item: any) => {
      const line: any = {
        quantity: item.cantidad,
        price: item.precio,
        total_money: item.precio * item.cantidad
      };
      
      // Si tiene ID válido se lo pasamos, si no, lo mandamos por nombre (custom item)
      if (item.loyverse_variant_id && item.loyverse_variant_id.trim() !== "") {
        line.variant_id = item.loyverse_variant_id;
      } else {
        line.item_name = item.nombre || 'Artículo de barra/cocina';
      }
      
      return line;
    });

    // 4. Construir payload con el store_id añadido
    const payload = {
      receipts: [
        {
          store_id: storeId, // Campo obligatorio
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
    if (!response.ok) throw new Error(data.errors?.[0]?.details || 'Error interno de Loyverse');

    return res.status(200).json({ success: true, loyverse_response: data });
  } catch (error: any) {
    console.error("Error en sync-receipt:", error);
    return res.status(500).json({ error: error.message });
  }
}