// src/InspectionReportPrint.ts
export interface FichajeParaInforme {
  id: string;
  empleado_id: string;
  tipo: string;
  timestamp_fichaje: string;
  notas?: string | null;
  empleados?: {
    nombre: string;
    apellidos?: string;
    dni_nie?: string;
    rol?: string;
  };
}

export interface DatosInformeInspeccion {
  empleadoNombre: string;
  empleadoDni: string;
  empleadoRol?: string;
  fechaDesde: string;
  fechaHasta: string;
  registros: FichajeParaInforme[];
  empresa?: {
    razonSocial: string;
    cif: string;
    direccion: string;
    centroTrabajo: string;
  };
}

interface JornadaDia {
  fecha: string;
  fechaFormateada: string;
  entradas: string[];
  salidas: string[];
  pausasInicio: string[];
  pausasFin: string[];
  totalHorasEfectivas: number;
  totalHorasPausa: number;
  observaciones: string[];
}

export function imprimirInformeInspeccionLaboral(datos: DatosInformeInspeccion): void {
  const empresa = datos.empresa || {
    razonSocial: 'NEXUS CAFETERÍA Y EVENTOS S.L.',
    cif: 'B00000000',
    direccion: 'Polígono Chinales 45, 14007 Córdoba',
    centroTrabajo: 'Nexus Gaming Center & Cafetería (Chinales 45)'
  };

  // 1. Agrupar fichajes por día (YYYY-MM-DD)
  const agrupadoPorDia: Record<string, FichajeParaInforme[]> = {};

  // Ordenar cronológicamente
  const ordenados = [...datos.registros].sort(
    (a, b) => new Date(a.timestamp_fichaje).getTime() - new Date(b.timestamp_fichaje).getTime()
  );

  for (const f of ordenados) {
    const d = new Date(f.timestamp_fichaje);
    const claveDia = d.toISOString().split('T')[0];
    if (!agrupadoPorDia[claveDia]) {
      agrupadoPorDia[claveDia] = [];
    }
    agrupadoPorDia[claveDia].push(f);
  }

  // 2. Calcular entradas, salidas, descansos y horas por día
  const diasProcesados: JornadaDia[] = [];
  let sumaHorasTotalesPeriodo = 0;

  const clavesDias = Object.keys(agrupadoPorDia).sort();

  for (const diaKey of clavesDias) {
    const fichajesDia = agrupadoPorDia[diaKey];
    const entradas: string[] = [];
    const salidas: string[] = [];
    const pausasInicio: string[] = [];
    const pausasFin: string[] = [];
    const observaciones: string[] = [];

    let tiempoEfectivoMs = 0;
    let tiempoPausaMs = 0;
    let ultimaEntradaMs: number | null = null;
    let ultimaPausaMs: number | null = null;

    for (const f of fichajesDia) {
      const dt = new Date(f.timestamp_fichaje);
      const horaStr = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const ms = dt.getTime();

      if (f.notas && f.notas.trim()) {
        observaciones.push(f.notas.trim());
      }

      switch (f.tipo) {
        case 'entrada':
          entradas.push(horaStr);
          ultimaEntradaMs = ms;
          break;
        case 'salida':
          salidas.push(horaStr);
          if (ultimaEntradaMs !== null) {
            tiempoEfectivoMs += Math.max(0, ms - ultimaEntradaMs);
            ultimaEntradaMs = null;
          }
          break;
        case 'inicio_descanso':
          pausasInicio.push(horaStr);
          if (ultimaEntradaMs !== null) {
            tiempoEfectivoMs += Math.max(0, ms - ultimaEntradaMs);
            ultimaEntradaMs = null;
          }
          ultimaPausaMs = ms;
          break;
        case 'fin_descanso':
          pausasFin.push(horaStr);
          if (ultimaPausaMs !== null) {
            tiempoPausaMs += Math.max(0, ms - ultimaPausaMs);
            ultimaPausaMs = null;
          }
          ultimaEntradaMs = ms;
          break;
        default:
          entradas.push(horaStr);
      }
    }

    // Si quedó un turno abierto sin salida al cierre del día, computar hasta última acción
    const horasEfectivas = Math.round((tiempoEfectivoMs / (1000 * 60 * 60)) * 100) / 100;
    const horasPausa = Math.round((tiempoPausaMs / (1000 * 60 * 60)) * 100) / 100;
    sumaHorasTotalesPeriodo += horasEfectivas;

    const [anio, mes, dia] = diaKey.split('-');
    const fechaObj = new Date(Number(anio), Number(mes) - 1, Number(dia));
    const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    diasProcesados.push({
      fecha: diaKey,
      fechaFormateada,
      entradas,
      salidas,
      pausasInicio,
      pausasFin,
      totalHorasEfectivas: horasEfectivas,
      totalHorasPausa: horasPausa,
      observaciones
    });
  }

  // 3. Generar HTML para el visor de impresión
  const filasHtml = diasProcesados
    .map(
      (d) => `
      <tr>
        <td style="border: 1px solid #334155; padding: 6px 8px; text-transform: capitalize; font-weight: bold;">
          ${d.fechaFormateada}
        </td>
        <td style="border: 1px solid #334155; padding: 6px 8px; text-align: center; font-family: monospace;">
          ${d.entradas.join(', ') || '-'}
        </td>
        <td style="border: 1px solid #334155; padding: 6px 8px; text-align: center; font-family: monospace; color: #475569;">
          ${d.pausasInicio.length ? d.pausasInicio.map((p, i) => `${p} - ${d.pausasFin[i] || '...'}`).join(' | ') : '-'}
        </td>
        <td style="border: 1px solid #334155; padding: 6px 8px; text-align: center; font-family: monospace;">
          ${d.salidas.join(', ') || '-'}
        </td>
        <td style="border: 1px solid #334155; padding: 6px 8px; text-align: right; font-family: monospace;">
          ${d.totalHorasPausa > 0 ? d.totalHorasPausa.toFixed(2) + ' h' : '-'}
        </td>
        <td style="border: 1px solid #334155; padding: 6px 8px; text-align: right; font-weight: bold; font-family: monospace;">
          ${d.totalHorasEfectivas.toFixed(2)} h
        </td>
        <td style="border: 1px solid #334155; padding: 6px 8px; font-size: 11px; color: #475569;">
          ${d.observaciones.join('; ') || ''}
        </td>
      </tr>
    `
    )
    .join('');

  const ventana = window.open('', '_blank');
  if (!ventana) {
    alert('Por favor, permite abrir ventanas emergentes para imprimir el informe laboral.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Registro Horario Oficial - ${datos.empleadoNombre}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm;
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          color: #0f172a;
          margin: 0;
          padding: 0;
          background: #ffffff;
        }
        .header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .header h1 {
          font-size: 16px;
          margin: 0 0 4px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header p {
          margin: 0;
          font-size: 11px;
          color: #475569;
        }
        .grid-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 12px;
          background-color: #f8fafc;
        }
        .grid-info div p {
          margin: 3px 0;
          font-size: 11px;
        }
        .grid-info div strong {
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 11px;
        }
        th {
          background-color: #f1f5f9;
          border: 1px solid #334155;
          padding: 8px 6px;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
        }
        .totales-box {
          display: flex;
          justify-content: flex-end;
          gap: 20px;
          margin-bottom: 30px;
          font-size: 13px;
        }
        .totales-box div {
          border: 1px solid #0f172a;
          padding: 8px 16px;
          border-radius: 6px;
          background-color: #f8fafc;
        }
        .firmas {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 40px;
          padding-top: 20px;
        }
        .firma-box {
          border-top: 1px solid #64748b;
          text-align: center;
          padding-top: 10px;
          font-size: 11px;
        }
        .legal-footer {
          margin-top: 30px;
          border-top: 1px dotted #94a3b8;
          padding-top: 8px;
          font-size: 9px;
          color: #64748b;
          text-align: justify;
        }
        @media print {
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="background: #e2e8f0; padding: 10px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 8px;">
        <span style="font-weight: bold; font-size: 13px;">Vista previa del informe laboral para Inspección</span>
        <div>
          <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-right: 8px;">🖨️ Imprimir / Guardar PDF</button>
          <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Cerrar</button>
        </div>
      </div>

      <div class="header">
        <h1>Registro Oficial Diario de Jornada Laboral</h1>
        <p>Conforme al Artículo 34.9 del Estatuto de los Trabajadores (Real Decreto-ley 8/2019, de 8 de marzo)</p>
      </div>

      <div class="grid-info">
        <div>
          <p><strong>Razón Social:</strong> ${empresa.razonSocial}</p>
          <p><strong>NIF / CIF:</strong> ${empresa.cif}</p>
          <p><strong>Dirección:</strong> ${empresa.direccion}</p>
          <p><strong>Centro de Trabajo:</strong> ${empresa.centroTrabajo}</p>
        </div>
        <div>
          <p><strong>Trabajador/a:</strong> ${datos.empleadoNombre}</p>
          <p><strong>DNI / NIE:</strong> ${datos.empleadoDni}</p>
          <p><strong>Puesto / Categoría:</strong> ${datos.empleadoRol || 'Personal de Hostelería'}</p>
          <p><strong>Período Inspeccionado:</strong> ${datos.fechaDesde} hasta ${datos.fechaHasta}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 15%;">Fecha</th>
            <th style="width: 14%; text-align: center;">Entrada</th>
            <th style="width: 20%; text-align: center;">Pausas / Descansos</th>
            <th style="width: 14%; text-align: center;">Salida</th>
            <th style="width: 11%; text-align: right;">Total Pausa</th>
            <th style="width: 13%; text-align: right;">H. Efectivas</th>
            <th style="width: 13%;">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          ${filasHtml.length > 0 ? filasHtml : '<tr><td colspan="7" style="text-align: center; padding: 15px;">No constan registros de jornada en el período seleccionado.</td></tr>'}
        </tbody>
      </table>

      <div class="totales-box">
        <div>
          <span>Días registrados: <strong>${diasProcesados.length}</strong></span>
        </div>
        <div>
          <span>Total Horas Efectivas: <strong>${sumaHorasTotalesPeriodo.toFixed(2)} h</strong></span>
        </div>
      </div>

      <div class="firmas">
        <div class="firma-box">
          <p><strong>Por la Empresa</strong></p>
          <p style="color: #64748b; font-size: 10px;">Firma y Sello del Representante</p>
          <div style="height: 60px;"></div>
        </div>
        <div class="firma-box">
          <p><strong>El/La Trabajador/a</strong></p>
          <p style="color: #64748b; font-size: 10px;">Conforme con el registro efectuado</p>
          <div style="height: 60px;"></div>
        </div>
      </div>

      <div class="legal-footer">
        Documento expedido y firmado en cumplimiento de las obligaciones legales establecidas en el artículo 34.9 del texto refundido de la Ley del Estatuto de los Trabajadores, aprobado por Real Decreto Legislativo 2/2015, y modificado por el Real Decreto-ley 8/2019, garantizando la inalterabilidad de los registros horarios para su puesta a disposición de los trabajadores, sus representantes y de la Inspección de Trabajo y Seguridad Social. Fecha de emisión: ${new Date().toLocaleDateString('es-ES')}.
      </div>
    </body>
    </html>
  `;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}
