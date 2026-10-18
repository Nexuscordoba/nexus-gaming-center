// @ts-nocheck
declare const process: { env: { [key: string]: string | undefined } };

const apiKey = (globalThis as any).process?.env?.LOYVERSE_API_KEY || 'c994da80cdff492b842fdac7be20ed85';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Falta configurar LOYVERSE_API_KEY en Vercel' });
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Obtener lista de artículos con sus variantes, precios y costes
    const itemsRes = await fetch('https://api.loyverse.com/v1.0/items?limit=250', { headers });
    const itemsData = await itemsRes.json();

    // 2. Obtener lista de variantes por si vienen desglosadas
    const variantsRes = await fetch('https://api.loyverse.com/v1.0/variants?limit=250', { headers });
    const variantsData = await variantsRes.json();

    // Mapear precios por variant_id si están en el endpoint de variants
    const variantDetailsMap = new Map();
    if (variantsData && variantsData.variants) {
      variantsData.variants.forEach((v: any) => {
        variantDetailsMap.set(v.variant_id, {
          price: v.default_price !== undefined ? v.default_price : (v.price || 0),
          cost: v.cost || 0
        });
      });
    }

    // Asegurar que cada variante del item tenga su precio y coste bien asignados
    const itemsProcesados = (itemsData.items || []).map((item: any) => {
      const vars = (item.variants || []).map((v: any) => {
        const extra = variantDetailsMap.get(v.variant_id) || {};
        return {
          ...v,
          price: v.default_price !== undefined ? v.default_price : (v.price ?? extra.price ?? 0),
          cost: v.cost ?? extra.cost ?? 0
        };
      });
      return {
        ...item,
        variants: vars
      };
    });

    // 3. Inventario / Stock
    const inventoryRes = await fetch('https://api.loyverse.com/v1.0/inventory?limit=250', { headers });
    const inventoryData = await inventoryRes.json();

    // 4. Últimos recibos / ventas
    const receiptsRes = await fetch('https://api.loyverse.com/v1.0/receipts?limit=50', { headers });
    const receiptsData = await receiptsRes.json();

    return res.status(200).json({
      items: itemsProcesados,
      inventory: inventoryData.inventory_levels || [],
      receipts: receiptsData.receipts || []
    });
  } catch (error: any) {
    console.error('Error al consultar la API de Loyverse:', error);
    return res.status(500).json({ error: error.message || 'Error al conectar con Loyverse' });
  }
}