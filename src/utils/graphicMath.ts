import { CutCalculationResult } from '../types';

export const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Retorna o mês e ano corrente por extenso (ex: "Outubro / 2026")
 */
export function getCurrentProductionMonth(): string {
  const d = new Date();
  return `${MONTHS_PT[d.getMonth()]} / ${d.getFullYear()}`;
}

/**
 * Retorna lista de sugestões de meses de produção (ano anterior, atual e próximo)
 */
export function getProductionMonthOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const list: string[] = [];
  for (const y of years) {
    for (const m of MONTHS_PT) {
      list.push(`${m} / ${y}`);
    }
  }
  return list;
}

/**
 * Calculates optimal graphic sheet cut utilization (Aproveitamento de Corte Gráfico).
 * Considers direct orientation and 90-degree rotated orientation.
 */
export function calculateCutYield(
  sheetW: number,
  sheetH: number,
  cutW: number,
  cutH: number
): CutCalculationResult {
  if (sheetW <= 0 || sheetH <= 0 || cutW <= 0 || cutH <= 0) {
    return {
      yield: 1,
      orientation: 'direct',
      cols: 1,
      rows: 1,
      efficiencyPercent: 0,
      wastePercent: 100,
      description: 'Dimensões inválidas',
      schematic: { sheetW, sheetH, cutW, cutH, cuts: [] },
    };
  }

  // 1. Direct Orientation (corte sem giro)
  const directCols = Math.floor(sheetW / cutW);
  const directRows = Math.floor(sheetH / cutH);
  const directTotal = directCols * directRows;

  // 2. Rotated Orientation (corte com giro de 90°)
  const rotCols = Math.floor(sheetW / cutH);
  const rotRows = Math.floor(sheetH / cutW);
  const rotTotal = rotCols * rotRows;

  let bestYield = directTotal;
  let bestOrientation: 'direct' | 'rotated' | 'mixed' = 'direct';
  let bestCols = directCols;
  let bestRows = directRows;

  if (rotTotal > bestYield) {
    bestYield = rotTotal;
    bestOrientation = 'rotated';
    bestCols = rotCols;
    bestRows = rotRows;
  }

  const finalYield = Math.max(1, bestYield);
  const sheetArea = sheetW * sheetH;
  const cutArea = cutW * cutH;
  const usedArea = bestYield * cutArea;
  const efficiencyPercent = sheetArea > 0 ? Math.min(100, (usedArea / sheetArea) * 100) : 0;
  const wastePercent = Math.max(0, 100 - efficiencyPercent);

  const cuts: Array<{ x: number; y: number; w: number; h: number; rotated: boolean }> = [];
  if (bestOrientation === 'direct') {
    for (let r = 0; r < bestRows; r++) {
      for (let c = 0; c < bestCols; c++) {
        cuts.push({ x: c * cutW, y: r * cutH, w: cutW, h: cutH, rotated: false });
      }
    }
  } else {
    for (let r = 0; r < bestRows; r++) {
      for (let c = 0; c < bestCols; c++) {
        cuts.push({ x: c * cutH, y: r * cutW, w: cutH, h: cutW, rotated: true });
      }
    }
  }

  const description =
    bestOrientation === 'direct'
      ? `${bestYield} poses (${bestCols} col × ${bestRows} lin) - Direto`
      : `${bestYield} poses (${bestCols} col × ${bestRows} lin) - Girado (90°)`;

  return {
    yield: finalYield,
    orientation: bestOrientation,
    cols: bestCols,
    rows: bestRows,
    efficiencyPercent: Math.round(efficiencyPercent * 10) / 10,
    wastePercent: Math.round(wastePercent * 10) / 10,
    description,
    schematic: { sheetW, sheetH, cutW, cutH, cuts },
  };
}

/**
 * Calculates complete production values for a Service Order:
 * 1. Total de Peças Finais = blocksQty * (sheetsPerBlock || 1) * (ways || 1)
 * 2. Total de Folhas Impressas = Math.ceil(Total de Peças Finais / ImagensPorChapa)
 * 3. Folhas Inteiras de Fábrica = Math.ceil(Total de Folhas Impressas / AproveitamentoDoPapel)
 * 4. Gasto Total de Papel = Folhas Inteiras de Fábrica + Quebra (Fls)
 * 
 * Regra Inteligente para Trabalhos Avulsos (Capas, Fichas, Cartões, etc.):
 * - Se 'sheetsPerBlock' (Folhas / Bloco) for igual a 0 ou vazio, assume internamente o valor 1.
 * - Se 'ways' (Vias) for igual a 0 ou vazio, assume internamente o valor 1.
 * - O campo 'blocksQty' funciona como a QUANTIDADE TOTAL do pedido nesses casos.
 * - O campo 'imagesPerPlate' divide o total de peças antes do aproveitamento do papel.
 */
export function calculateOrderMath(params: {
  blocksQty: number;
  sheetsPerBlock: number;
  ways: number;
  imagesPerPlate: number; // Imagens por Chapa
  breakMargin: number;
  sheetW: number;
  sheetH: number;
  cutW: number;
  cutH: number;
}) {
  const blocks = Math.max(0, Number(params.blocksQty) || 0);

  // Se 'sheetsPerBlock' for 0, vazio ou undefined, assume internamente 1
  const effectiveSheetsPerBlock =
    params.sheetsPerBlock !== undefined && Number(params.sheetsPerBlock) > 0
      ? Number(params.sheetsPerBlock)
      : 1;

  // Se 'ways' for 0, vazio ou undefined, assume internamente 1
  const effectiveWays =
    params.ways !== undefined && Number(params.ways) > 0
      ? Number(params.ways)
      : 1;

  // Imagens por chapa (divisor obrigatório antes do aproveitamento, padrão 1)
  const images =
    params.imagesPerPlate !== undefined && Number(params.imagesPerPlate) > 0
      ? Number(params.imagesPerPlate)
      : 1;

  // Unidades de corte extras desejadas para acerto (ex: 50 capas de sobra)
  const breakCutUnits = Math.max(0, Number(params.breakMargin) || 0);

  // 1. Total de Peças Finais = blocksQty * (sheetsPerBlock || 1) * (ways || 1)
  const rawProductPieces = blocks * effectiveSheetsPerBlock * effectiveWays;

  // 2. Total de Folhas Impressas = Math.ceil(Total de Peças Finais / ImagensPorChapa)
  const totalFinalSheets =
    rawProductPieces > 0 ? Math.ceil(rawProductPieces / images) : 0;

  // 3. Aproveitamento do papel de fábrica (Cortes por Folha Inteira)
  const cutResult = calculateCutYield(params.sheetW, params.sheetH, params.cutW, params.cutH);
  const yieldPerSheet = cutResult.yield;

  // 4. Folhas Inteiras de Fábrica Necessárias = Math.ceil(Total de Folhas Impressas / Aproveitamento do Papel)
  const fullSheetsNeeded =
    totalFinalSheets > 0 && yieldPerSheet > 0
      ? Math.ceil(totalFinalSheets / yieldPerSheet)
      : 0;

  // 5. Folhas de Quebra = Math.ceil(Quebra / Aproveitamento)
  const breakSheetsNeeded =
    breakCutUnits > 0 && yieldPerSheet > 0
      ? Math.ceil(breakCutUnits / yieldPerSheet)
      : 0;

  // 6. Gasto Total de Papel de Fábrica = Folhas Inteiras Necessárias + Folhas de Quebra
  const totalFactorySheetsUsed = fullSheetsNeeded + breakSheetsNeeded;

  return {
    rawProductPieces,
    totalFinalSheets,
    yieldPerSheet,
    cutsDescription: cutResult.description,
    fullSheetsNeeded,
    breakCutUnits,
    breakSheetsNeeded,
    totalFactorySheetsUsed,
    efficiencyPercent: cutResult.efficiencyPercent,
    cutResult,
    effectiveSheetsPerBlock,
    effectiveWays,
    imagesPerPlate: images,
  };
}
