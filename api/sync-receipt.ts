// api/sync-receipt.ts
declare var process: any;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.LOYVERSE_API_KEY; 
  if (!token) {
    return res.status(500).json({ error: 'No token configurado en Vercel' });
  }

  try {
    const { receipt_number, total_money, payment_type, items } = req.body;

    // 1. Obtener Tienda (store_id)
    const storeRes = await fetch('https://api.loyverse.com/v1.0/stores', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const storeData = await storeRes.json();
    const storeId = storeData.stores?.[0]?.id;

    // 2. Obtener Caja Registradora (pos_id)
    const posRes = await fetch('https://api.loyverse.com/v1.0/pos_devices', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const posData = await posRes.json();
    const posId = posData.pos_devices?.[0]?.id;

    // 3. Obtener Empleado (employee_id)
    const empRes = await fetch('https://api.loyverse.com/v1.0/employees', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const empData = await empRes.json();
    const empId = empData.employees?.[0]?.id;

    if (!storeId || !posId || !empId) {
      throw new Error(`Faltan datos base en Loyverse (Store: ${storeId}, POS: ${posId}, Emp: ${empId})`);
    }

    // 4. Obtener Tipos de Pago
    const payRes = await fetch('https://api.loyverse.com/v1.0/payment_types', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const payData = await payRes.json();
    let paymentTypeId = payData.payment_types?.[0]?.id; 
    const tipoBuscado = payment_type === 'efectivo' ? 'CASH' : 'CARD';
    const tipoEncontrado = payData.payment_types?.find((p: any) => p.type === tipoBuscado);
    if (tipoEncontrado) paymentTypeId = tipoEncontrado.id;

    // 5. Cargar Catálogo de Loyverse
    const itemsRes = await fetch('https://api.loyverse.com/v1.0/items?limit=250', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const itemsLoyverseData = await itemsRes.json();
    const loyItems = itemsLoyverseData.items || [];

    // 6. Formatear items con búsqueda flexible (SKU o Nombre)
    const line_items = [];

    for (const item of items) {
      const quantity = Number(item.cantidad) || 1;
      const price = Number(item.precio) || 0;
      const nombreItemInput = (item.nombre || '').trim().toLowerCase();
      const refBuscada = item.loyverse_variant_id?.trim();
      
      let resolvedItemId = null;
      let resolvedVariantId = null;
      
      // PASO A: Buscar por SKU / variant_id exacto
      if (refBuscada) {
        for (const loyItem of loyItems) {
          const matchedVariant = loyItem.variants?.find((v: any) => v.sku === refBuscada || v.id === refBuscada);
          if (matchedVariant) {
            resolvedItemId = loyItem.id;
            resolvedVariantId = matchedVariant.id;
            break;
          }
        }
      }

      // PASO B: Si no se encontró por SKU, buscar por coincidencia de nombre exacto
      if (!resolvedItemId || !resolvedVariantId) {
        for (const loyItem of loyItems) {
          const loyName = (loyItem.item_name || loyItem.name || '').trim().toLowerCase();
          if (loyName === nombreItemInput) {
            resolvedItemId = loyItem.id;
            resolvedVariantId = loyItem.variants?.[0]?.id;
            break;
          }
        }
      }

      // PASO C: Respaldo de emergencia (coge el primer ítem que haya para que el ticket nunca falle por culpa de un artículo)
      if ((!resolvedItemId || !resolvedVariantId) && loyItems.length > 0) {
        resolvedItemId = loyItems[0].id;
        resolvedVariantId = loyItems[0].variants?.[0]?.id;
      }

      if (!resolvedItemId || !resolvedVariantId) {
         throw new Error(`No se pudo asociar el artículo "${item.nombre}" con ningún producto en Loyverse.`);
      }

      line_items.push({
        item_id: resolvedItemId,
        variant_id: resolvedVariantId,
        quantity: quantity,
        price: price,
        total_money: price * quantity
      });
    }

    // 7. Construir paquete final
    const payload = {
      store_id: storeId,
      pos_id: posId,
      employee_id: empId,
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
      const errorDetails = data.errors?.[0];
      const errorField = errorDetails?.field ? `Falta el campo: ${errorDetails.field}` : JSON.stringify(errorDetails || data);
      throw new Error(`Rechazado por Loyverse -> ${errorField}`);
    }

    return res.status(200).json({ success: true, loyverse_response: data });
  } catch (error: any) {
    console.error("Error en sync-receipt:", error);
    return res.status(500).json({ error: error.message });
  }
}