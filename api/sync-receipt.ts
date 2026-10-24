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

    // 2. Obtener Caja Registradora (pos_id) - OBLIGATORIO EN LOYVERSE
    const posRes = await fetch('https://api.loyverse.com/v1.0/pos_devices', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const posData = await posRes.json();
    const posId = posData.pos_devices?.[0]?.id;

    // 3. Obtener Empleado (employee_id) - OBLIGATORIO EN LOYVERSE
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

    // 5. Cargar Items de Loyverse para resolver el item_id padre (Obligatorio)
    const itemsRes = await fetch('https://api.loyverse.com/v1.0/items', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const itemsLoyverseData = await itemsRes.json();
    const loyItems = itemsLoyverseData.items || [];

    // 6. Formatear items de forma segura
    const line_items = items.map((item: any) => {
      const quantity = Number(item.cantidad) || 1;
      const price = Number(item.precio) || 0;
      
      const lineItem: any = {
        quantity: quantity,
        price: price,
        total_money: price * quantity
      };

      let resolvedItemId = null;
      let resolvedVariantId = item.loyverse_variant_id?.trim();

      // Si tenemos variant_id, buscamos su item_id padre
      if (resolvedVariantId) {
        for (const loyItem of loyItems) {
          if (loyItem.variants && loyItem.variants.some((v: any) => v.id === resolvedVariantId)) {
            resolvedItemId = loyItem.id;
            break;
          }
        }
      } 
      
      // Si no lo encuentra por ID, lo busca por nombre exacto
      if (!resolvedItemId) {
        for (const loyItem of loyItems) {
          if (loyItem.item_name.toLowerCase() === item.nombre.toLowerCase()) {
            resolvedItemId = loyItem.id;
            resolvedVariantId = loyItem.variants?.[0]?.id;
            break;
          }
        }
      }

      // Si encuentra la pareja de IDs la asigna, si no, lo pasa como artículo libre
      if (resolvedItemId && resolvedVariantId) {
        lineItem.item_id = resolvedItemId;
        lineItem.variant_id = resolvedVariantId;
      } else {
        lineItem.item_name = (item.nombre || "Artículo de barra/cocina").substring(0, 50);
      }

      return lineItem;
    });

    // 7. Construir paquete final con todos los campos obligatorios
    const payload = {
      receipts: [
        {
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
      // Si falla, formatea el error para que veamos qué campo exacto pide Loyverse
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