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

    // 1. Obtener el Store ID (Tienda)
    const storeRes = await fetch('https://api.loyverse.com/v1.0/stores', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const storeData = await storeRes.json();
    const storeId = storeData.stores?.[0]?.id;
    
    if (!storeId) {
      throw new Error("No se pudo recuperar el ID de la tienda en Loyverse.");
    }

    // 2. Obtener los métodos de pago
    const payRes = await fetch('https://api.loyverse.com/v1.0/payment_types', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const payData = await payRes.json();
    
    let paymentTypeId = payData.payment_types?.[0]?.id; 
    const tipoBuscado = payment_type === 'efectivo' ? 'CASH' : 'CARD';
    const tipoEncontrado = payData.payment_types?.find((p: any) => p.type === tipoBuscado);
    if (tipoEncontrado) paymentTypeId = tipoEncontrado.id;

    // 3. Mapeo estricto de los ítems para evitar campos vacíos o nulos
    const line_items = items.map((item: any) => {
      const quantity = Number(item.cantidad) || 1;
      const price = Number(item.precio) || 0;
      
      const lineItem: any = {
        quantity: quantity,
        price: price,
        total_money: price * quantity
      };

      // Si tiene un variant_id válido de Loyverse lo usamos; si no, pasamos item_name
      if (item.loyverse_variant_id && item.loyverse_variant_id.trim() !== "") {
        lineItem.variant_id = item.loyverse_variant_id.trim();
      } else {
        lineItem.item_name = (item.nombre || "Artículo libre").substring(0, 50);
      }

      return lineItem;
    });

    // 4. Estructura exacta requerida por Loyverse v1.0 para Receipts
    const payload = {
      receipts: [
        {
          store_id: storeId,
          receipt_number: `NEX-${receipt_number}`,
          receipt_date: new Date().toISOString(),
          receipt_type: "SALE",
          total_money: Number(total_money),
          total_discount: 0,
          line_items: line_items,
          payments: [
            {
              payment_type_id: paymentTypeId, 
              money_amount: Number(total_money)
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
    if (!response.ok) {
      const errorMsg = data.message || data.errors?.[0]?.details || JSON.stringify(data);
      throw new Error(errorMsg);
    }

    return res.status(200).json({ success: true, loyverse_response: data });
  } catch (error: any) {
    console.error("Error en sync-receipt:", error);
    return res.status(500).json({ error: error.message });
  }
}