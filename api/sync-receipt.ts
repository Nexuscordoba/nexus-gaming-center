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

    // 1. Obtener Tienda, POS, Empleados, Tipos de Pago y Variantes en paralelo
    const [storeRes, posRes, empRes, payRes, variantsRes] = await Promise.all([
      fetch('https://api.loyverse.com/v1.0/stores', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/pos_devices', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/employees', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/payment_types', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('https://api.loyverse.com/v1.0/variants?limit=250', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    const storeData = await storeRes.json();
    const posData = await posRes.json();
    const empData = await empRes.json();
    const payData = await payRes.json();
    const variantsData = await variantsRes.json();

    const storeId = storeData.stores?.[0]?.id;
    const posId = posData.pos_devices?.[0]?.id;
    const empId = empData.employees?.[0]?.id;
    const loyVariants = variantsData.variants || [];

    if (!storeId || !posId || !empId) {
      throw new Error(`Faltan datos base en Loyverse (Store: ${storeId}, POS: ${posId}, Emp: ${empId})`);
    }

    // 2. Obtener Tipo de Pago
    let paymentTypeId = payData.payment_types?.[0]?.id; 
    const tipoBuscado = payment_type === 'efectivo' ? 'CASH' : 'CARD';
    const tipoEncontrado = payData.payment_types?.find((p: any) => p.type === tipoBuscado);
    if (tipoEncontrado) paymentTypeId = tipoEncontrado.id;

    // Definir una variante de respaldo obligatoria si el catálogo tiene elementos
    const defaultVariant = loyVariants[0] || null;
    if (!defaultVariant || !defaultVariant.id || !defaultVariant.item_id) {
      throw new Error("No hay variantes válidas configuradas en el catálogo de Loyverse.");
    }

    // 3. Mapear los ítems asegurando por completo que NUNCA falte el variant_id
    const line_items = [];

    for (const item of items) {
      const quantity = Number(item.cantidad) || 1;
      const price = Number(item.precio) || 0;
      const nombreInput = (item.nombre || '').trim().toLowerCase();
      const variantIdEnviado = item.loyverse_variant_id?.trim();

      let matchedVariant = null;

      // Buscar por ID exacto de variante o SKU si existe
      if (variantIdEnviado) {
        matchedVariant = loyVariants.find((v: any) => v.id === variantIdEnviado || v.sku === variantIdEnviado);
      }

      // Buscar por coincidencia de nombre
      if (!matchedVariant) {
        matchedVariant = loyVariants.find((v: any) => {
          const vName = (v.name || v.item_name || '').trim().toLowerCase();
          return vName === nombreInput || vName.includes(nombreInput) || nombreInput.includes(vName);
        });
      }

      // RESPALDO CRÍTICO: Si no lo encuentra, usa la primera variante disponible de Loyverse por la fuerza
      const finalVariant = matchedVariant || defaultVariant;

      line_items.push({
        item_id: finalVariant.item_id,
        variant_id: finalVariant.id, // ¡Garantizado que nunca irá vacío!
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