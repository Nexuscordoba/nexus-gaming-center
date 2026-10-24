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

    // 1. Obtener Tienda, POS, Empleados y Tipos de Pago en paralelo
    const [storeRes, posRes, empRes, payRes, itemsRes] = await Promise.all([
      fetch('https://api.loyverse.com/v1.0/stores', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/pos_devices', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/employees', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/payment_types', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/items', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    const storeData = await storeRes.json();
    const posData = await posRes.json();
    const empData = await empRes.json();
    const payData = await payRes.json();
    const itemsData = await itemsRes.json();

    const storeId = storeData.stores?.[0]?.id;
    const posId = posData.pos_devices?.[0]?.id;
    const empId = empData.employees?.[0]?.id;
    const loyItems = itemsData.items || [];

    if (!storeId || !posId || !empId) {
      throw new Error(`Faltan datos base en Loyverse (Store: ${storeId}, POS: ${posId}, Emp: ${empId})`);
    }

    // 2. Obtener Tipo de Pago
    let paymentTypeId = payData.payment_types?.[0]?.id; 
    const tipoBuscado = payment_type === 'efectivo' ? 'CASH' : 'CARD';
    const tipoEncontrado = payData.payment_types?.find((p: any) => p.type === tipoBuscado);
    if (tipoEncontrado) paymentTypeId = tipoEncontrado.id;

    // 3. Obtener una variante de respaldo global del catálogo por si algún producto no coincide
    const fallbackItem = loyItems[0] || null;
    const fallbackVariantId = fallbackItem?.variants?.[0]?.id || null;
    const fallbackItemId = fallbackItem?.id || null;

    // 4. Mapear cada artículo del ticket con tolerancia absoluta
    const line_items = [];

    for (const item of items) {
      const quantity = Number(item.cantidad) || 1;
      const price = Number(item.precio) || 0;
      const nombreInput = (item.nombre || '').trim().toLowerCase();
      const refBuscada = item.loyverse_variant_id?.trim();

      let matchedItem = null;
      let matchedVariant = null;

      if (loyItems.length > 0) {
        // Búsqueda por SKU o ID exacto
        if (refBuscada) {
          for (const lItem of loyItems) {
            const v = lItem.variants?.find((varObj: any) => varObj.sku === refBuscada || varObj.id === refBuscada);
            if (v) {
              matchedItem = lItem;
              matchedVariant = v;
              break;
            }
          }
        }

        // Búsqueda por coincidencia de nombre
        if (!matchedVariant) {
          for (const lItem of loyItems) {
            const lName = (lItem.item_name || lItem.name || '').trim().toLowerCase();
            if (lName === nombreInput || lName.includes(nombreInput) || nombreInput.includes(lName)) {
              matchedItem = lItem;
              matchedVariant = lItem.variants?.[0];
              break;
            }
          }
        }
      }

      // Si no encuentra coincidencia pero hay productos en Loyverse, usa el primero
      if (!matchedVariant && fallbackVariantId && fallbackItemId) {
        matchedItem = fallbackItem;
        matchedVariant = fallbackItem.variants?.[0];
      }

      // Si por completo el catálogo está vacío en la API, generamos un item directo utilizando los datos del TPV
      const finalItemId = matchedItem?.id || fallbackItemId || "item-generico-nexus";
      const finalVariantId = matchedVariant?.id || fallbackVariantId || "variant-generico-nexus";

      line_items.push({
        item_id: finalItemId,
        variant_id: finalVariantId,
        quantity: quantity,
        price: price,
        total_money: price * quantity
      });
    }

    // 5. Construir paquete final para la API de recibos de Loyverse
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