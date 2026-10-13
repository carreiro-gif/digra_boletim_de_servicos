import { CutCalculationResult, MaterialType, PaperFactory } from '../types';

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
 * Gera o texto explicativo da conta de produção em formato simples e direto:
 * Ex: "20 BLOCOS × 100 FOLHAS = 2.000 UNIDADES ÷ 2 IMAGENS/CHAPA = 1.000 FOLHAS + 10% DE SOBRA = 1.100 FOLHAS"
 */
export function formatProductionFormula(params: {
  blocksQty: number;
  materialType?: MaterialType;
  unitMultiplier?: number;
  ways?: number;
  imagesPerPlate?: number;
  surplusPercent?: number;
  rawUnits: number;
  totalPieces: number;
  printedSheetsLiquid: number;
  sobraSheets: number;
  totalPrintedSheets: number;
}): string {
  const {
    blocksQty,
    materialType = 'BLOCO',
    unitMultiplier = 100,
    ways = 1,
    imagesPerPlate = 1,
    surplusPercent = 10,
    rawUnits,
    totalPieces,
    printedSheetsLiquid,
    totalPrintedSheets,
  } = params;

  if (!blocksQty || blocksQty <= 0) return '';

  let baseStr = '';
  if (materialType === 'BLOCO') {
    const plural = blocksQty === 1 ? 'BLOCO' : 'BLOCOS';
    baseStr = `${blocksQty} ${plural} × ${unitMultiplier} FOLHAS = ${rawUnits.toLocaleString('pt-BR')} UNIDADES`;
  } else if (materialType === 'PACOTE') {
    const plural = blocksQty === 1 ? 'PACOTE' : 'PACOTES';
    baseStr = `${blocksQty} ${plural} × ${unitMultiplier} UNIDADES = ${rawUnits.toLocaleString('pt-BR')} UNIDADES`;
  } else if (materialType === 'FICHA') {
    const plural = blocksQty === 1 ? 'FICHA' : 'FICHAS';
    baseStr = `${blocksQty} ${plural} = ${rawUnits.toLocaleString('pt-BR')} UNIDADES`;
  } else if (materialType === 'ETIQUETA') {
    const plural = blocksQty === 1 ? 'ETIQUETA' : 'ETIQUETAS';
    baseStr = `${blocksQty} ${plural} = ${rawUnits.toLocaleString('pt-BR')} UNIDADES`;
  } else if (materialType === 'CAPA') {
    const plural = blocksQty === 1 ? 'CAPA' : 'CAPAS';
    baseStr = `${blocksQty} ${plural} = ${rawUnits.toLocaleString('pt-BR')} UNIDADES`;
  } else {
    const plural = blocksQty === 1 ? 'UNIDADE' : 'UNIDADES';
    baseStr = `${blocksQty} ${plural} = ${rawUnits.toLocaleString('pt-BR')} UNIDADES`;
  }

  const waysStr = ways > 1 ? ` × ${ways} VIAS = ${totalPieces.toLocaleString('pt-BR')} PEÇAS` : '';
  const imgStr = ` ÷ ${imagesPerPlate} IMAGENS/CHAPA = ${printedSheetsLiquid.toLocaleString('pt-BR')} FOLHAS`;
  const sobraStr = ` + ${surplusPercent}% DE SOBRA = ${totalPrintedSheets.toLocaleString('pt-BR')} FOLHAS`;

  return `${baseStr}${waysStr}${imgStr}${sobraStr}`;
}

/**
 * Calculates complete production values for a Service Order:
 * 1. Unidades Totais = Quantidade × (folhas por bloco, ou unidades por pacote, ou 1)
 * 2. Total de Peças = Unidades Totais × Vias
 * 3. Folhas Líquidas Necessárias (impressas) = Math.ceil(Total de Peças / ImagensPorChapa)
 * 4. Sobra em Folhas = Math.ceil(Folhas Líquidas × Percentual ÷ 100)
 * 5. Total de Folhas Impressas = Folhas Líquidas + Sobra em Folhas
 * 6. Folhas Inteiras de Fábrica = Math.ceil(Folhas Líquidas / AproveitamentoDoPapel)
 * 7. Sobra em Folhas de Fábrica = Math.ceil(Folhas Inteiras de Fábrica × Percentual ÷ 100)
 * 8. Gasto Total de Papel de Fábrica = Folhas Inteiras + Sobra de Fábrica
 */
export function calculateOrderMath(params: {
  blocksQty: number;
  sheetsPerBlock?: number;
  ways?: number;
  wayColors?: string[]; // Cores das vias (Via 1 Branca, etc.)
  imagesPerPlate?: number; // Imagens por Chapa
  breakMargin?: number; // Sobra legada (em un/folhas)
  sheetW: number;
  sheetH: number;
  cutW: number;
  cutH: number;
  materialType?: MaterialType;
  unitMultiplier?: number;
  surplusPercent?: number; // Sobra (Acerto) em porcentagem (padrão 10%)
}) {
  const blocks = params.blocksQty !== undefined && Number(params.blocksQty) > 0 ? Number(params.blocksQty) : 0;

  // Tipo de material: padrão 'OUTROS' (multiplicador 1) se não definido,
  // mas se sheetsPerBlock ou unitMultiplier > 1 for informado sem tipo explícito, infere BLOCO ou PACOTE
  const matType: MaterialType =
    params.materialType ||
    (params.sheetsPerBlock && Number(params.sheetsPerBlock) > 1
      ? 'BLOCO'
      : (params.unitMultiplier && Number(params.unitMultiplier) > 1 ? 'PACOTE' : 'OUTROS'));

  let multiplier = 1;
  if (matType === 'BLOCO') {
    const val =
      params.unitMultiplier !== undefined && Number(params.unitMultiplier) > 0
        ? Number(params.unitMultiplier)
        : (params.sheetsPerBlock !== undefined && Number(params.sheetsPerBlock) > 0 ? Number(params.sheetsPerBlock) : 100);
    multiplier = val > 0 ? val : 1;
  } else if (matType === 'PACOTE') {
    const val =
      params.unitMultiplier !== undefined && Number(params.unitMultiplier) > 0
        ? Number(params.unitMultiplier)
        : 100;
    multiplier = val > 0 ? val : 1;
  } else {
    multiplier = 1;
  }
  if (isNaN(multiplier) || multiplier <= 0) {
    multiplier = 1;
  }

  // Vias (mínimo 1, padrão 1 se vazio ou inválido)
  const effectiveWays =
    params.ways !== undefined && Number(params.ways) > 0
      ? Math.max(1, Math.floor(Number(params.ways)))
      : 1;

  // Imagens por chapa (obrigatória para emissão; padrão 0 se não preenchido)
  const rawImages =
    params.imagesPerPlate !== undefined ? Number(params.imagesPerPlate) : 0;
  const images = rawImages > 0 ? rawImages : 0;

  // Aproveitamento do papel de fábrica (Cortes por Folha Inteira)
  const sheetW = Number(params.sheetW) > 0 ? Number(params.sheetW) : 660;
  const sheetH = Number(params.sheetH) > 0 ? Number(params.sheetH) : 960;
  const cutW = Number(params.cutW) > 0 ? Number(params.cutW) : 660;
  const cutH = Number(params.cutH) > 0 ? Number(params.cutH) : 960;

  const cutResult = calculateCutYield(sheetW, sheetH, cutW, cutH);
  const yieldPerSheet = cutResult.yield > 0 ? cutResult.yield : 1;

  // Sobra (Acerto) % (padrão 10% se vazio ou não informado)
  const surplusPercent =
    params.surplusPercent !== undefined && !isNaN(Number(params.surplusPercent))
      ? Math.max(0, Number(params.surplusPercent))
      : 10;

  // Se Quantidade ou Imagens/Chapa não foram preenchidos (<= 0), a matemática mostra 0
  if (blocks <= 0 || images <= 0) {
    return {
      rawUnits: 0,
      rawProductPieces: 0,
      totalFinalSheets: 0,
      yieldPerSheet,
      cutsDescription: cutResult.description,
      fullSheetsNeeded: 0,
      sobraSheets: 0,
      breakCutUnits: 0,
      breakSheetsNeeded: 0,
      totalFactorySheetsUsed: 0,
      totalPrintedSheets: 0,
      surplusPercent,
      efficiencyPercent: cutResult.efficiencyPercent,
      cutResult,
      effectiveSheetsPerBlock: multiplier,
      effectiveWays,
      imagesPerPlate: images,
      materialType: matType,
      unitMultiplier: multiplier,
      formulaDescription: '',
      colorBreakdown: [] as {
        color: string;
        waysCount: number;
        printedSheets: number;
        liquidSheets: number;
        surplusSheets: number;
        totalColorSheets: number;
      }[],
    };
  }

  // 1. Unidades Totais = Quantidade × multiplicador do tipo (folhas por bloco, unidades por pacote, ou 1)
  const rawUnits = blocks * multiplier;

  // 2. Total de Peças Finais = Unidades Totais × Vias
  const rawProductPieces = rawUnits * effectiveWays;

  // Cores das vias (Via 1 sempre 'Branca', demais conforme lista ou 'Branca')
  const wayColorsList: string[] = [];
  if (effectiveWays === 1) {
    wayColorsList.push('Branca');
  } else {
    const rawList = params.wayColors && Array.isArray(params.wayColors) ? params.wayColors : [];
    for (let i = 0; i < effectiveWays; i++) {
      if (i === 0) {
        wayColorsList.push('Branca');
      } else {
        const c = (rawList[i] || '').trim();
        wayColorsList.push(c || 'Branca');
      }
    }
  }

  // Agrupamento por cor: some as vias que têm a mesma cor
  const colorMap = new Map<string, number>();
  for (const c of wayColorsList) {
    const normalized = c.trim() || 'Branca';
    colorMap.set(normalized, (colorMap.get(normalized) || 0) + 1);
  }

  const colorBreakdown: {
    color: string;
    waysCount: number;
    printedSheets: number;
    liquidSheets: number;
    surplusSheets: number;
    totalColorSheets: number;
  }[] = [];

  let sumPrintedSheets = 0;
  let sumFullSheetsNeeded = 0;
  let sumBreakSheetsNeeded = 0;
  let sumTotalFactorySheets = 0;

  // REGRAS POR COR:
  // Para cada cor:
  // - folhas impressas = Math.ceil((unidades totais * vias da cor) ÷ imagens por chapa)
  // - folhas líquidas = Math.ceil(folhas impressas da cor ÷ poses)
  // - sobra = Math.ceil(líquidas × percentual de sobra ÷ 100)
  // - total da cor = líquidas + sobra
  colorMap.forEach((count, color) => {
    const printedColorSheets = Math.ceil((rawUnits * count) / images);
    const liquidColorSheets = Math.ceil(printedColorSheets / yieldPerSheet);
    const surplusColorSheets = Math.ceil((liquidColorSheets * surplusPercent) / 100);
    const totalColorSheets = liquidColorSheets + surplusColorSheets;

    colorBreakdown.push({
      color,
      waysCount: count,
      printedSheets: printedColorSheets,
      liquidSheets: liquidColorSheets,
      surplusSheets: surplusColorSheets,
      totalColorSheets,
    });

    sumPrintedSheets += printedColorSheets;
    sumFullSheetsNeeded += liquidColorSheets;
    sumBreakSheetsNeeded += surplusColorSheets;
    sumTotalFactorySheets += totalColorSheets;
  });

  // Totais consolidados
  const totalFinalSheets = sumPrintedSheets; // Total de folhas impressas líquidas da tiragem
  const fullSheetsNeeded = sumFullSheetsNeeded; // Total de folhas inteiras líquidas de fábrica
  const breakSheetsNeeded = sumBreakSheetsNeeded; // Total de sobra em folhas inteiras de fábrica
  const totalFactorySheetsUsed = sumTotalFactorySheets; // Gasto Total de Papel (soma dos totais de todas as cores)

  // Sobra de acerto calculada sobre as folhas impressas
  const sobraSheets = Math.ceil((totalFinalSheets * surplusPercent) / 100);
  const totalPrintedSheets = totalFinalSheets + sobraSheets;

  // Memória de cálculo resumida
  const formulaDescription = formatProductionFormula({
    blocksQty: blocks,
    materialType: matType,
    unitMultiplier: multiplier,
    ways: effectiveWays,
    imagesPerPlate: images,
    surplusPercent,
    rawUnits,
    totalPieces: rawProductPieces,
    printedSheetsLiquid: totalFinalSheets,
    sobraSheets: breakSheetsNeeded,
    totalPrintedSheets: totalFactorySheetsUsed,
  });

  return {
    rawUnits,
    rawProductPieces,
    totalFinalSheets, // 1. Total Folhas Finais Impressas Líquidas
    yieldPerSheet, // 2. Aproveitamento (poses por folha)
    cutsDescription: cutResult.description,
    fullSheetsNeeded, // 3. Folhas Líquidas Necessárias (Fábrica)
    sobraSheets, // Sobra em folhas de impressão
    breakCutUnits: sobraSheets,
    breakSheetsNeeded, // + Sobra (Acerto) em folhas inteiras de fábrica
    totalFactorySheetsUsed, // Gasto Total de Papel de Fábrica (soma das cores)
    totalPrintedSheets, // Folhas impressas com sobra
    surplusPercent,
    efficiencyPercent: cutResult.efficiencyPercent,
    cutResult,
    effectiveSheetsPerBlock: multiplier,
    effectiveWays,
    imagesPerPlate: images,
    materialType: matType,
    unitMultiplier: multiplier,
    formulaDescription,
    colorBreakdown,
  };
}

/**
 * Formata a conversão exata do consumo de papel em pacotes fechados e folhas restantes:
 * Divisão inteira (Math.floor(total / pacote)) e resto (total % pacote).
 * Exemplo: 165 folhas com pacote de 150 -> "1 pacote fechado + 15 folhas"
 */
export function formatPackageBreakdownText(totalSheets: number, sheetsPerPack: number): string {
  const total = Math.max(0, Math.ceil(totalSheets || 0));
  const packSize = Number(sheetsPerPack) > 0 ? Number(sheetsPerPack) : 250;

  if (total === 0) return '0 folhas';

  const fullPackages = Math.floor(total / packSize);
  const remainder = total % packSize;

  const packWord = fullPackages === 1 ? 'pacote fechado' : 'pacotes fechados';
  const sheetWord = remainder === 1 ? 'folha' : 'folhas';

  if (fullPackages === 0) {
    return `0 pacotes fechados + ${remainder} ${sheetWord}`;
  }

  if (remainder === 0) {
    return `${fullPackages} ${packWord}`;
  }

  return `${fullPackages} ${packWord} + ${remainder} ${sheetWord}`;
}

/**
 * Formata o detalhamento de pacotes para a frase automática do cortador:
 * Se houver pelo menos 1 pacote fechado (fullPackages >= 1), acrescenta:
 * " ([X] PACOTE(S) FECHADO(S) + [Y] FOLHAS)"
 */
export function formatCutterPackageSpec(totalSheets: number, sheetsPerPack: number): string {
  const total = Math.max(0, Math.ceil(totalSheets || 0));
  const packSize = Number(sheetsPerPack) > 0 ? Number(sheetsPerPack) : 250;

  if (total === 0) return '';

  const fullPackages = Math.floor(total / packSize);
  const remainder = total % packSize;

  if (fullPackages >= 1) {
    const packWord = fullPackages === 1 ? 'PACOTE FECHADO' : 'PACOTES FECHADOS';
    const sheetWord = remainder === 1 ? 'FOLHA' : 'FOLHAS';
    if (remainder > 0) {
      return ` (${fullPackages} ${packWord} + ${remainder} ${sheetWord})`;
    }
    return ` (${fullPackages} ${packWord})`;
  }

  return '';
}

/**
 * SELEÇÃO DE PAPEL POR PALAVRA-CHAVE (SUGESTÃO DINÂMICA):
 * Se NÃO houver histórico gravado no banco para o serviço, analisa a descrição/nome do trabalho:
 * - Se conter "CAPA" ou "FICHA" -> Seleciona papel de 180g (ex: Cartolina Branca - 180g).
 * - Se conter "BLOCO", "FORMULÁRIO" ou "LIVRO" -> Seleciona papel de 75g (ex: Offset 75g).
 * - Se conter "ETIQUETA" -> Selecionar papel Adesivo (ex: Adesivo Fosco - 180g).
 * - Caso não se enquadre em nenhuma das regras acima: retorna '' (campo inicia totalmente vazio).
 */
export function sugerirPapelPorPalavraChave(
  nomeTrabalho: string,
  papersList: PaperFactory[]
): string {
  if (!nomeTrabalho || typeof nomeTrabalho !== 'string') return '';
  const normalizado = nomeTrabalho
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  // 1. "CAPA" ou "FICHA" -> Selecionar papel de 180g
  if (normalizado.includes('CAPA') || normalizado.includes('FICHA')) {
    const pap180 =
      papersList.find((p) => p.grammage === 180 && !p.name.toLowerCase().includes('adesivo')) ||
      papersList.find((p) => p.grammage === 180) ||
      papersList.find((p) => p.name.includes('180'));
    return pap180 ? pap180.id : '';
  }

  // 2. "BLOCO", "FORMULÁRIO" ou "LIVRO" -> Selecionar papel de 75g
  if (
    normalizado.includes('BLOCO') ||
    normalizado.includes('FORMULARIO') ||
    normalizado.includes('LIVRO')
  ) {
    const pap75 =
      papersList.find(
        (p) =>
          p.grammage === 75 &&
          !(p.color || '').toLowerCase().includes('azul') &&
          !(p.color || '').toLowerCase().includes('amarela')
      ) ||
      papersList.find((p) => p.grammage === 75) ||
      papersList.find((p) => p.name.includes('75'));
    return pap75 ? pap75.id : '';
  }

  // 3. "ETIQUETA" -> Selecionar papel Adesivo
  if (normalizado.includes('ETIQUETA')) {
    const papAdesivo =
      papersList.find(
        (p) => p.name.toLowerCase().includes('adesivo') || p.code.toLowerCase().includes('ad')
      ) ||
      papersList.find((p) => p.name.toLowerCase().includes('adesivo'));
    return papAdesivo ? papAdesivo.id : '';
  }

  return '';
}

