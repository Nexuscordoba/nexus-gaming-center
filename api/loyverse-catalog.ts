// api/loyverse-catalog.ts
declare var process: any;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.LOYVERSE_API_KEY; 
  if (!token) {
    return res.status(500).json({ error: 'No token configurado en Vercel' });
  }

  try {
    // Pedimos hasta 250 artículos (el límite por página de Loyverse)
    const response = await fetch('https://api.loyverse.com/v1.0/items?limit=250', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.errors?.[0]?.details || 'Error leyendo el catálogo de Loyverse');

    // Limpiamos los datos para enviar solo lo que Supabase necesita
    const catalog = data.items.map((item: any) => {
      const mainVariant = item.variants?.[0] || {};
      return {
        nombre: item.item_name,
        precio: mainVariant.price || 0,
        sku: mainVariant.sku || ''
      };
    });

    return res.status(200).json({ success: true, items: catalog });
  } catch (error: any) {
    console.error("Error obteniendo catalogo:", error);
    return res.status(500).json({ error: error.message });
  }
}