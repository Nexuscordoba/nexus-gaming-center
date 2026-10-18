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
    // 1. Obtener lista de artículos e inventario
    const itemsRes = await fetch('https://api.loyverse.com/v1.0/items?limit=100', { headers });
    const itemsData = await itemsRes.json();

    // 2. Obtener lista de inventario / stock
    const inventoryRes = await fetch('https://api.loyverse.com/v1.0/inventory?limit=100', { headers });
    const inventoryData = await inventoryRes.json();

    // 3. Obtener últimos recibos/ventas
    const receiptsRes = await fetch('https://api.loyverse.com/v1.0/receipts?limit=50', { headers });
    const receiptsData = await receiptsRes.json();

    return res.status(200).json({
      items: itemsData.items || [],
      inventory: inventoryData.inventory_levels || [],
      receipts: receiptsData.receipts || []
    });
  } catch (error: any) {
    console.error('Error al consultar la API de Loyverse:', error);
    return res.status(500).json({ error: error.message || 'Error al conectar con Loyverse' });
  }
}