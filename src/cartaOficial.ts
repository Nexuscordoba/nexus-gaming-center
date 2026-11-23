// src/cartaOficial.ts
// Definición oficial de las 5 familias y productos de Café Bar Nexus (Carta_Cafe_Bar_Nexus.pdf)

export type FamiliaCartaId =
  | 'desayunos'
  | 'menu_dia'
  | 'bocadillos'
  | 'tapas'
  | 'bebidas';

export interface FamiliaCartaDef {
  id: FamiliaCartaId;
  nombre: string;
  subtitulo: string;
  columnaPrecio1?: string;
  columnaPrecio2?: string;
}

export interface ItemCartaPublica {
  id: string;
  nombre: string;
  descripcion?: string;
  familia: FamiliaCartaId;
  categoriaNombre: string;
  precio?: number;
  precioTexto?: string;
  precio1?: number; // Media o Tapa
  precio2?: number; // Entera o Ración
  esGuisosLink?: boolean;
  alergenos: string[];
  trazas: string[];
  desdeDB?: boolean;
}

export const FAMILIAS_OFICIALES: readonly FamiliaCartaDef[] = [
  {
    id: 'desayunos',
    nombre: 'Desayunos y Cafés',
    subtitulo: 'Cafés de especialidad, zumos naturales, combos y tostadas',
    columnaPrecio1: 'Media',
    columnaPrecio2: 'Entera'
  },
  {
    id: 'menu_dia',
    nombre: 'Menú del Día',
    subtitulo: 'Cocina casera diaria · Lunes a Viernes'
  },
  {
    id: 'bocadillos',
    nombre: 'Bocadillos y Sándwiches',
    subtitulo: 'Recién hechos al momento'
  },
  {
    id: 'tapas',
    nombre: 'Tapas y Raciones',
    subtitulo: 'Para picar o compartir',
    columnaPrecio1: 'Tapa',
    columnaPrecio2: 'Ración'
  },
  {
    id: 'bebidas',
    nombre: 'Bebidas',
    subtitulo: 'Cervezas, refrescos, vinos y copas'
  }
] as const;

export const ITEMS_CARTA_OFICIAL: ItemCartaPublica[] = [
  // 1. DESAYUNOS Y CAFÉS
  {
    id: 'of-cafe-solo',
    nombre: 'Café solo / Cortado / Con leche',
    familia: 'desayunos',
    categoriaNombre: 'Desayunos y Cafés',
    precio: 1.5,
    alergenos: ['Lácteos'],
    trazas: []
  },
  {
    id: 'of-cafe-doble',
    nombre: 'Café doble / Manchado largo / Bombón',
    familia: 'desayunos',
    categoriaNombre: 'Desayunos y Cafés',
    precio: 1.7,
    alergenos: ['Lácteos'],
    trazas: []
  },
  {
    id: 'of-colacao',
    nombre: 'Cola Cao / Chocolate caliente',
    familia: 'desayunos',
    categoriaNombre: 'Desayunos y Cafés',
    precio: 2.0,
    alergenos: ['Lácteos', 'Gluten'],
    trazas: ['Soja', 'Frutos de cáscara']
  },
  {
    id: 'of-infusiones',
    nombre: 'Infusiones',
    descripcion: 'Manzanilla, tila, poleo, té',
    familia: 'desayunos',
    categoriaNombre: 'Desayunos y Cafés',
    precio: 1.5,
    alergenos: [],
    trazas: []
  },
  {
    id: 'of-zumo-naranja',
    nombre: 'Zumo de naranja natural',
    familia: 'desayunos',
    categoriaNombre: 'Desayunos y Cafés',
    precio: 2.5,
    alergenos: [],
    trazas: []
  },
  {
    id: 'of-combo-desayuno',
    nombre: 'Combo desayuno',
    descripcion: 'Café + tostada clásica',
    familia: 'desayunos',
    categoriaNombre: 'Desayunos y Cafés',
    precio1: 2.8,
    precio2: 3.6,
    alergenos: ['Gluten', 'Lácteos'],
    trazas: ['Sésamo']
  },
  {
    id: 'of-tostada-clasica',
    nombre: 'Tostada Aceite y tomate / Mantequilla y mermelada / Paté',
    familia: 'desayunos',
    categoriaNombre: 'Desayunos y Cafés',
    precio1: 1.5,
    precio2: 2.3,
    alergenos: ['Gluten', 'Lácteos'],
    trazas: ['Soja', 'Sésamo']
  },
  {
    id: 'of-tostada-mixta',
    nombre: 'Tostada Mixta',
    descripcion: 'Jamón cocido y queso',
    familia: 'desayunos',
    categoriaNombre: 'Desayunos y Cafés',
    precio1: 2.0,
    precio2: 3.0,
    alergenos: ['Gluten', 'Lácteos'],
    trazas: ['Soja', 'Sésamo']
  },
  {
    id: 'of-tostada-jamon',
    nombre: 'Tostada Jamón serrano',
    descripcion: 'Con aceite y tomate',
    familia: 'desayunos',
    categoriaNombre: 'Desayunos y Cafés',
    precio1: 2.3,
    precio2: 3.5,
    alergenos: ['Gluten'],
    trazas: ['Sésamo']
  },
  {
    id: 'of-tostada-tortilla-bacon',
    nombre: 'Tostada Tortilla de patatas / Bacon con queso',
    familia: 'desayunos',
    categoriaNombre: 'Desayunos y Cafés',
    precio1: 2.5,
    precio2: 3.8,
    alergenos: ['Gluten', 'Huevos', 'Lácteos'],
    trazas: ['Sésamo']
  },

  // 2. MENÚ DEL DÍA
  {
    id: 'of-menu-dia',
    nombre: 'Menú del Día',
    descripcion: '1º + 2º + pan + postre o café + bebida',
    familia: 'menu_dia',
    categoriaNombre: 'Menú del Día',
    precio: 12.0,
    alergenos: ['Gluten'],
    trazas: ['Lácteos', 'Huevos', 'Sulfitos']
  },
  {
    id: 'of-medio-menu',
    nombre: 'Medio Menú',
    descripcion: '1 plato + postre o café + bebida',
    familia: 'menu_dia',
    categoriaNombre: 'Menú del Día',
    precio: 8.0,
    alergenos: ['Gluten'],
    trazas: ['Lácteos', 'Huevos', 'Sulfitos']
  },
  {
    id: 'of-guisos-casa',
    nombre: 'Guisos de la Casa',
    descripcion: 'Pregunta al camarero · incluye pan',
    familia: 'menu_dia',
    categoriaNombre: 'Menú del Día',
    precioTexto: 'Consultar',
    esGuisosLink: true,
    alergenos: ['Gluten'],
    trazas: ['Apio', 'Sulfitos']
  },

  // 3. BOCADILLOS Y SÁNDWICHES
  {
    id: 'of-sandwich-mixto',
    nombre: 'Sándwich Mixto',
    descripcion: 'Jamón y queso',
    familia: 'bocadillos',
    categoriaNombre: 'Bocadillos y Sándwiches',
    precio: 3.5,
    alergenos: ['Gluten', 'Lácteos'],
    trazas: ['Huevos', 'Soja', 'Sésamo']
  },
  {
    id: 'of-sandwich-vegetal',
    nombre: 'Sándwich Vegetal',
    descripcion: 'Atún, huevo, lechuga, tomate, mayonesa',
    familia: 'bocadillos',
    categoriaNombre: 'Bocadillos y Sándwiches',
    precio: 4.5,
    alergenos: ['Gluten', 'Pescado', 'Huevos'],
    trazas: ['Mostaza', 'Soja', 'Lácteos', 'Sésamo']
  },
  {
    id: 'of-bocadillo-jamon',
    nombre: 'Bocadillo de Jamón serrano con tomate y aceite',
    familia: 'bocadillos',
    categoriaNombre: 'Bocadillos y Sándwiches',
    precio: 4.5,
    alergenos: ['Gluten'],
    trazas: ['Sésamo']
  },
  {
    id: 'of-bocadillo-tortilla',
    nombre: 'Bocadillo de Tortilla de patatas',
    familia: 'bocadillos',
    categoriaNombre: 'Bocadillos y Sándwiches',
    precio: 4.5,
    alergenos: ['Gluten', 'Huevos'],
    trazas: ['Lácteos', 'Sésamo']
  },
  {
    id: 'of-bocadillo-lomo',
    nombre: 'Bocadillo de Lomo a la plancha',
    descripcion: 'Con queso o pimientos',
    familia: 'bocadillos',
    categoriaNombre: 'Bocadillos y Sándwiches',
    precio: 5.0,
    alergenos: ['Gluten', 'Lácteos'],
    trazas: ['Sésamo']
  },
  {
    id: 'of-bocadillo-pollo',
    nombre: 'Bocadillo de Pechuga de pollo',
    descripcion: 'Con alioli o queso',
    familia: 'bocadillos',
    categoriaNombre: 'Bocadillos y Sándwiches',
    precio: 5.0,
    alergenos: ['Gluten', 'Huevos', 'Lácteos'],
    trazas: ['Mostaza', 'Sésamo']
  },
  {
    id: 'of-serranito',
    nombre: 'Serranito',
    descripcion: 'Lomo o pollo, jamón serrano, pimiento frito y alioli',
    familia: 'bocadillos',
    categoriaNombre: 'Bocadillos y Sándwiches',
    precio: 5.5,
    alergenos: ['Gluten', 'Huevos'],
    trazas: ['Mostaza', 'Lácteos', 'Sésamo']
  },
  {
    id: 'of-bocadillo-bacon',
    nombre: 'Bocadillo de Bacon con queso',
    familia: 'bocadillos',
    categoriaNombre: 'Bocadillos y Sándwiches',
    precio: 5.0,
    alergenos: ['Gluten', 'Lácteos'],
    trazas: ['Sésamo']
  },

  // 4. TAPAS Y RACIONES
  {
    id: 'of-salmorejo',
    nombre: 'Salmorejo cordobés',
    descripcion: 'Con jamón y huevo',
    familia: 'tapas',
    categoriaNombre: 'Tapas y Raciones',
    precio1: 3.5,
    precio2: 8.5,
    alergenos: ['Gluten', 'Huevos'],
    trazas: []
  },
  {
    id: 'of-ensaladilla',
    nombre: 'Ensaladilla rusa',
    familia: 'tapas',
    categoriaNombre: 'Tapas y Raciones',
    precio1: 3.5,
    precio2: 8.0,
    alergenos: ['Huevos', 'Pescado'],
    trazas: ['Mostaza']
  },
  {
    id: 'of-tortilla',
    nombre: 'Tortilla de patatas',
    familia: 'tapas',
    categoriaNombre: 'Tapas y Raciones',
    precio1: 3.0,
    precio2: 7.5,
    alergenos: ['Huevos'],
    trazas: []
  },
  {
    id: 'of-bravas',
    nombre: 'Patatas bravas / Alioli',
    familia: 'tapas',
    categoriaNombre: 'Tapas y Raciones',
    precio1: 3.5,
    precio2: 7.5,
    alergenos: ['Huevos'],
    trazas: ['Gluten', 'Mostaza', 'Apio', 'Sulfitos']
  },
  {
    id: 'of-croquetas',
    nombre: 'Croquetas caseras',
    descripcion: 'Jamón / puchero',
    familia: 'tapas',
    categoriaNombre: 'Tapas y Raciones',
    precio1: 3.5,
    precio2: 9.5,
    alergenos: ['Gluten', 'Lácteos', 'Huevos'],
    trazas: ['Apio']
  },

  // 5. BEBIDAS
  {
    id: 'of-agua',
    nombre: 'Agua mineral (50 cl)',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 1.5,
    alergenos: [],
    trazas: []
  },
  {
    id: 'of-cana',
    nombre: 'Caña de cerveza',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 1.6,
    alergenos: ['Gluten'],
    trazas: ['Sulfitos']
  },
  {
    id: 'of-tubo-tercio',
    nombre: 'Tubo / Copa de cerveza / Tercio',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 2.2,
    alergenos: ['Gluten'],
    trazas: ['Sulfitos']
  },
  {
    id: 'of-jarra',
    nombre: 'Jarra de cerveza (50 cl)',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 3.5,
    alergenos: ['Gluten'],
    trazas: ['Sulfitos']
  },
  {
    id: 'of-refrescos',
    nombre: 'Refrescos',
    descripcion: 'Coca-Cola, Fanta, Aquarius, Nestea, Tónica',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 2.4,
    alergenos: [],
    trazas: []
  },
  {
    id: 'of-zumos-batidos',
    nombre: 'Zumos en botella (melocotón, piña) / Batidos',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 2.2,
    alergenos: ['Lácteos'],
    trazas: []
  },
  {
    id: 'of-tinto-verano',
    nombre: 'Tinto de verano',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 2.5,
    alergenos: ['Sulfitos'],
    trazas: []
  },
  {
    id: 'of-copa-vino',
    nombre: 'Copa de vino',
    descripcion: 'Montilla-Moriles, Rioja, Ribera, Verdejo',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 2.8,
    alergenos: ['Sulfitos'],
    trazas: []
  },
  {
    id: 'of-copas-nacionales',
    nombre: 'Combinados / Copas nacionales',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 6.0,
    alergenos: [],
    trazas: ['Sulfitos']
  },
  {
    id: 'of-copas-premium',
    nombre: 'Combinados / Copas importación / Premium',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 7.5,
    alergenos: [],
    trazas: ['Sulfitos']
  },
  {
    id: 'of-chupitos',
    nombre: 'Chupitos',
    familia: 'bebidas',
    categoriaNombre: 'Bebidas',
    precio: 2.5,
    alergenos: [],
    trazas: ['Lácteos', 'Sulfitos']
  }
];

export function inferirFamiliaDesdeProducto(nombre: string, categoria: string): FamiliaCartaId {
  const txt = `${categoria} ${nombre}`.toLowerCase();
  if (
    txt.includes('desayun') ||
    txt.includes('café') ||
    txt.includes('cafe') ||
    txt.includes('tostada') ||
    txt.includes('cola cao') ||
    txt.includes('chocolate') ||
    txt.includes('infusion') ||
    txt.includes('zumo de naranja') ||
    txt.includes('combo desayuno')
  ) {
    return 'desayunos';
  }
  if (txt.includes('menú') || txt.includes('menu') || txt.includes('guiso')) {
    return 'menu_dia';
  }
  if (txt.includes('bocadillo') || txt.includes('sándwich') || txt.includes('sandwich') || txt.includes('serranito')) {
    return 'bocadillos';
  }
  if (
    txt.includes('tapa') ||
    txt.includes('ración') ||
    txt.includes('racion') ||
    txt.includes('salmorejo') ||
    txt.includes('ensaladilla') ||
    txt.includes('croqueta') ||
    txt.includes('brava') ||
    txt.includes('tortilla de patatas')
  ) {
    return 'tapas';
  }
  if (
    txt.includes('bebida') ||
    txt.includes('agua') ||
    txt.includes('cerveza') ||
    txt.includes('caña') ||
    txt.includes('jarra') ||
    txt.includes('tercio') ||
    txt.includes('refresco') ||
    txt.includes('zumo') ||
    txt.includes('batido') ||
    txt.includes('tinto') ||
    txt.includes('vino') ||
    txt.includes('copa') ||
    txt.includes('combinado') ||
    txt.includes('chupito')
  ) {
    return 'bebidas';
  }
  return 'tapas';
}

export function formatearPrecioEuro(precio?: number): string {
  if (typeof precio !== 'number' || Number.isNaN(precio)) return '';
  return `${precio.toFixed(2).replace('.', ',')} €`;
}

export interface ProductoCartaDB {
  id?: string | number;
  nombre?: string;
  categoria?: string;
  precio?: number;
  activo?: boolean;
  alergenos?: string[];
  trazas?: string[];
}

/**
 * Combina los productos activos de `productos_carta` en Supabase con la carta oficial
 * de Café Bar Nexus para garantizar que las 5 familias, precios exactos y alérgenos
 * siempre se muestren completos y actualizados.
 */
export function construirCartaPublica(productosDB: ProductoCartaDB[]): ItemCartaPublica[] {
  const resultado: ItemCartaPublica[] = ITEMS_CARTA_OFICIAL.map((item) => ({ ...item }));

  const normalizar = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  for (const dbProd of productosDB || []) {
    if (dbProd.activo === false) continue;
    const nombreDB = String(dbProd.nombre || '').trim();
    if (!nombreDB) continue;
    const nombreNorm = normalizar(nombreDB);

    const alergenosDB = Array.isArray(dbProd.alergenos) ? dbProd.alergenos : undefined;
    const trazasDB = Array.isArray(dbProd.trazas) ? dbProd.trazas : undefined;

    // Buscar coincidencia exacta o parcial con la carta oficial para actualizar precio / alérgenos desde Supabase
    const match = resultado.find((ofItem) => {
      const ofNorm = normalizar(ofItem.nombre);
      return ofNorm === nombreNorm || ofNorm.includes(nombreNorm) || nombreNorm.includes(ofNorm);
    });

    if (match) {
      if (alergenosDB && alergenosDB.length > 0) match.alergenos = alergenosDB;
      if (trazasDB && trazasDB.length > 0) match.trazas = trazasDB;
      if (typeof dbProd.precio === 'number' && match.precio !== undefined && match.precio1 === undefined) {
        match.precio = dbProd.precio;
      }
      match.desdeDB = true;
    } else {
      // Producto adicional en productos_carta que no estaba en el listado base
      const familia = inferirFamiliaDesdeProducto(nombreDB, String(dbProd.categoria || ''));
      const famDef = FAMILIAS_OFICIALES.find((f) => f.id === familia);
      resultado.push({
        id: `db-${dbProd.id}`,
        nombre: nombreDB,
        familia,
        categoriaNombre: famDef?.nombre || String(dbProd.categoria || 'Carta'),
        precio: Number(dbProd.precio || 0),
        alergenos: alergenosDB || [],
        trazas: trazasDB || [],
        desdeDB: true
      });
    }
  }

  return resultado;
}
