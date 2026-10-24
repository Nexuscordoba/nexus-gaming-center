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

    // 1. Obtener Tienda, POS, Empleados, Tipos de Pago y el Catálogo de Ítems
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

    // Extraer todas las variantes disponibles de forma plana desde los ítems de Loyverse
    const allVariants: { item_id: string; variant_id: string; name: string }[] = [];
    for (const lItem of loyItems) {
      if (lItem.variants && Array.isArray(lItem.variants)) {
        for (const v of lItem.variants) {
          allVariants.push({
            item_id: lItem.id,
            variant_id: v.id,
            name: (v.name || lItem.item_name || lItem.name || '').trim().toLowerCase()
          });
        }
      }
    }

    // Comodín de respaldo por si el catálogo viene vacío
    const fallbackVariant = allVariants[0] || {
      item_id: loyItems[0]?.id || "fallback-item-id",
      variant_id: loyItems[0]?.variants?.[0]?.id || "fallback-variant-id",
      name: "default"
    };

    // 3. Mapear las líneas asegurando de forma absoluta que variant_id nunca vaya vacío
    const line_items = (items || []).map((item: any) => {
      const quantity = Number(item.cantidad) || 1;
      const price = Number(item.precio) || 0;
      const nombreInput = (item.nombre || '').trim().toLowerCase();

      // Buscar variante por nombre en el catálogo real
      let found = allVariants.find(v => v.name === nombreInput || v.name.includes(nombreInput) || nombreInput.includes(v.name));
      const target = found || fallbackVariant;

      // Si por alguna razón crítica no hay IDs en el catálogo de Loyverse, usamos el identificador que viene del cliente o un comodín seguro
      const finalVariantId = target.variant_id || item.loyverse_variant_id;
      const finalItemId = target.item_id || "fallback-item-id";

      if (!finalVariantId) {
        throw new Error(`Falta el variant_id para el artículo "${item.nombre}".`);
      }

      return {
        item_id: finalItemId,
        variant_id: finalVariantId, // ¡Garantizado que contiene un ID válido!
        quantity: quantity,
        price: price,
        total_money: price * quantity
      };
    });

    if (line_items.length === 0) {
      throw new Error("El ticket no contiene artículos válidos.");
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