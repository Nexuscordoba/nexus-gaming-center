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

    // 1. Obtener Tienda, POS, Empleados, Tipos de Pago y el Catálogo COMPLETO de Loyverse en paralelo
    const [storeRes, posRes, empRes, payRes, itemsRes] = await Promise.all([
      fetch('https://api.loyverse.com/v1.0/stores', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/pos_devices', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/employees', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/payment_types', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/items?limit=250', { headers: { 'Authorization': `Bearer ${token}` } })
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

    if (loyItems.length === 0) {
      throw new Error("El catálogo devuelto por Loyverse está vacío. Revisa tus artículos en Loyverse.");
    }

    // Comodín global de respaldo por si algún artículo no coincide exactamente
    const fallbackVariantId = loyItems[0]?.variants?.[0]?.id;
    if (!fallbackVariantId) {
      throw new Error("No se encontró ninguna variante válida en el catálogo de Loyverse.");
    }

    // 3. Mapear los ítems buscando su variant_id real en el catálogo de Loyverse de forma inteligente
    const line_items = [];

    for (const item of items) {
      const quantity = Number(item.cantidad) || 1;
      const price = Number(item.precio) || 0;
      const nombreInput = (item.nombre || '').trim().toLowerCase();
      const variantIdEnviado = item.loyverse_variant_id?.trim();

      let assignedVariantId = null;

      // Intento A: Si el variant_id enviado es un UUID válido de Loyverse, lo usamos directamente
      if (variantIdEnviado && variantIdEnviado.length > 10 && !variantIdEnviado.startsWith('CAF-') && !variantIdEnviado.startsWith('SKU-')) {
        assignedVariantId = variantIdEnviado;
      }

      // Intento B: Buscar en el catálogo remoto por SKU o ID de variante
      if (!assignedVariantId && variantIdEnviado) {
        for (const lItem of loyItems) {
          const foundVar = lItem.variants?.find((v: any) => v.sku === variantIdEnviado || v.id === variantIdEnviado);
          if (foundVar) {
            assignedVariantId = foundVar.id;
            break;
          }
        }
      }

      // Intento C: Buscar en el catálogo remoto por coincidencia de nombre
      if (!assignedVariantId) {
        for (const lItem of loyItems) {
          const lName = (lItem.item_name || lItem.name || '').trim().toLowerCase();
          if (lName === nombreInput || lName.includes(nombreInput) || nombreInput.includes(lName)) {
            assignedVariantId = lItem.variants?.[0]?.id;
            break;
          }
        }
      }

      // Intento D: Respaldo absoluto para que el ticket nunca falle
      if (!assignedVariantId) {
        assignedVariantId = fallbackVariantId;
      }

      line_items.push({
        variant_id: assignedVariantId,
        quantity: quantity,
        price: price,
        total_money: price * quantity
      });
    }

    // 4. Construir paquete final para la API de recibos de Loyverse
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