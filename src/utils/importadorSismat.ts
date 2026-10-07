import * as XLSX from 'xlsx';

const xlsxLib: any = ('default' in XLSX ? (XLSX as any).default : XLSX) || XLSX;
import { ServiceOrder, PaperFactory, CutFormat, ServiceCatalog, OrderStatus } from '../types';
import { calculateOrderMath } from './graphicMath';
import { db, isFirebaseConfigured } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import sismatPreloadData from '../data/sismatHistoricoPreload.json';
import fichasTecnicasRaw from '../data/fichas_tecnicas.json';

export interface SismatFichaTecnica {
  bsNumber: string;
  bsYear: string;
  materialCode: string;
  trabalho: string;
  formato: string;
  cutWidthMm: number;
  cutHeightMm: number;
  paperName: string;
  paperCode: string;
  paperWidthMm: number;
  paperHeightMm: number;
  packageSheets: number;
  blocksQty: number;
  sheetsPerBlock: number;
  ways: number;
  imagesPerPlate: number;
  breakMargin: number;
  machine: string;
  productionMonth: string;
  yieldPerSheet: number;
  rawFilename: string;
}

export const SISMAT_IMPORT_KEY = 'pjerj_sismat_historico_imported_v2';

/**
 * Normaliza códigos de materiais gráficos (ex: "651-0199" -> "6510199")
 */
export function normalizeMaterialCode(code: string): string {
  if (!code) return '';
  return code.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
}

/**
 * Extrai Número do BS, Ano e Código do Material a partir do nome do arquivo
 * Exemplo: "BS 28-2026 - 653-0085.xlsx" -> { bsNumber: "28", bsYear: "2026", materialCode: "653-0085" }
 */
export function parseSismatFilename(filename: string): {
  bsNumber: string;
  bsYear: string;
  materialCode: string;
  rawFilename: string;
} {
  const cleanName = filename.replace(/\.xlsx$/i, '').trim();

  // Expressão regular robusta com suporte a múltiplos espaços, traços e barras
  const match = cleanName.match(/BS\s*(\d+)\s*[-/ ]\s*(\d{4})\s*[-–]\s*(\d{3}[-\s]\d{4})/i);
  if (match) {
    return {
      bsNumber: match[1].padStart(2, '0'),
      bsYear: match[2],
      materialCode: match[3].replace(/\s+/, '-'),
      rawFilename: filename,
    };
  }

  // Fallback para nomes com outros formatos
  const fallback = cleanName.match(/BS\s*(\d+)[^0-9]+(\d{4})[^0-9]+(\d{3}[-\s]\d{4})/i);
  if (fallback) {
    return {
      bsNumber: fallback[1].padStart(2, '0'),
      bsYear: fallback[2],
      materialCode: fallback[3].replace(/\s+/, '-'),
      rawFilename: filename,
    };
  }

  // Tenta extrair código do material isolado se BS falhar
  const codeOnly = cleanName.match(/(\d{3}[-\s]\d{4})/);
  const yearOnly = cleanName.match(/(2025|2026|2027)/);
  const bsOnly = cleanName.match(/BS\s*(\d+)/i);

  return {
    bsNumber: bsOnly ? bsOnly[1].padStart(2, '0') : '01',
    bsYear: yearOnly ? yearOnly[1] : '2026',
    materialCode: codeOnly ? codeOnly[1].replace(/\s+/, '-') : '651-0000',
    rawFilename: filename,
  };
}

/**
 * Extrai os dados técnicos de uma planilha Excel do SISMAT/DIGRA
 * Captura: Nome do Trabalho (B5 ou fallback A5) e Formato (A19)
 */
export function extrairDadosPlanilha(
  sheet: XLSX.WorkSheet,
  filename: string
): SismatFichaTecnica {
  const meta = parseSismatFilename(filename);

  // 1. Nome do Trabalho: Célula B5 (com fallback para A5 sem o prefixo "Confecção:")
  let trabalho = '';
  if (sheet['B5'] && sheet['B5'].v !== undefined && String(sheet['B5'].v).trim() !== '') {
    trabalho = String(sheet['B5'].v).trim();
  } else if (sheet['A5'] && sheet['A5'].v !== undefined) {
    const rawA5 = String(sheet['A5'].v).trim();
    trabalho = rawA5.replace(/^Confecção:\s*/i, '').trim();
  }
  if (!trabalho) {
    trabalho = `Material Gráfico ${meta.materialCode}`;
  }

  // 2. Formato: Célula A19 (ex: "FORMATO MODELO: 210x105 mm")
  const rawA19 = sheet['A19']?.v ? String(sheet['A19'].v).trim() : '';
  const formato = rawA19 || 'FORMATO MODELO: 210x297 mm';

  const fmtMatch = formato.match(/(\d+)\s*[xX]\s*(\d+)/);
  const cutWidthMm = fmtMatch ? parseInt(fmtMatch[1], 10) : 210;
  const cutHeightMm = fmtMatch ? parseInt(fmtMatch[2], 10) : 297;

  // 3. Papel de Fábrica (células D11, I11, I13 com marcação "X")
  let paperName = 'Papel Off-set 75 Gr/m²';
  let paperCode = 'OFF-75';
  const paperWidthMm = 660;
  const paperHeightMm = 960;
  const packageSheets = 250;

  if (sheet['I11']?.v && String(sheet['I11'].v).toUpperCase().includes('X')) {
    paperName = 'Papel Kraft 110 Gr/m²';
    paperCode = 'KRF-110';
  } else if (sheet['I13']?.v && String(sheet['I13'].v).toUpperCase().includes('X')) {
    const cor = sheet['J13']?.v ? ` Cor: ${sheet['J13'].v}` : '';
    paperName = `Papel Off-set 75 Gr/m²${cor}`;
    paperCode = 'OFF-75-COR';
  } else if (sheet['D11']?.v && String(sheet['D11'].v).toUpperCase().includes('X')) {
    paperName = 'Papel Off-set 75 Gr/m²';
    paperCode = 'OFF-75';
  }

  // 4. Quantidade e especificações (célula I7)
  const rawI7 = sheet['I7']?.v ? String(sheet['I7'].v) : '';
  const qMatch = rawI7.match(/(\d+)\s*Bl/i);
  const flsMatch = rawI7.match(/(\d+)\s*fls/i);
  const waysMatch = rawI7.match(/(\d+)\s*via/i);

  const blocksQty = qMatch ? parseInt(qMatch[1], 10) : 50;
  const sheetsPerBlock = flsMatch ? parseInt(flsMatch[1], 10) : 50;
  const ways = waysMatch ? parseInt(waysMatch[1], 10) : 1;

  // 5. Máquina de Impressão (célula G1)
  const rawG1 = sheet['G1']?.v ? String(sheet['G1'].v) : '';
  let machine = 'Sakurai';
  if (/HEIDELBERG[^_]*[xX]/i.test(rawG1)) {
    machine = 'Heidelberg Bicolor';
  } else if (/SAKURAI[^_]*[xX]/i.test(rawG1)) {
    machine = 'Sakurai';
  } else if (/CATU[^_]*[xX]/i.test(rawG1)) {
    machine = 'Sakurai';
  } else if (/XEROX[^_]*[xX]/i.test(rawG1)) {
    machine = 'Heidelberg Bicolor';
  }

  // 6. Mês de Produção (célula A7)
  const rawA7 = sheet['A7']?.v ? String(sheet['A7'].v) : '';
  const monthMatch = rawA7.match(/Produ[cç][aã]o:?\s*([A-Za-zÇç]+)/i);
  const rawMonth = monthMatch ? monthMatch[1].toUpperCase() : 'MARÇO';
  const monthCapitalized = rawMonth.charAt(0) + rawMonth.slice(1).toLowerCase();
  const productionMonth = `${monthCapitalized} / ${meta.bsYear}`;

  // 7. Aproveitamento / Quantidade por folha (célula H19)
  const rawH19 = sheet['H19']?.v ? String(sheet['H19'].v) : '';
  const yieldMatch = rawH19.match(/QUANTIDADE POR FOLHA\s*=\s*(\d+)/i);
  const yieldPerSheet = yieldMatch
    ? parseInt(yieldMatch[1], 10)
    : Math.max(1, Math.floor((paperWidthMm / cutWidthMm) * (paperHeightMm / cutHeightMm)));

  const breakMargin = Math.max(10, Math.round(blocksQty * 0.05));

  return {
    bsNumber: meta.bsNumber,
    bsYear: meta.bsYear,
    materialCode: meta.materialCode,
    trabalho,
    formato,
    cutWidthMm,
    cutHeightMm,
    paperName,
    paperCode,
    paperWidthMm,
    paperHeightMm,
    packageSheets,
    blocksQty,
    sheetsPerBlock,
    ways,
    imagesPerPlate: 1,
    breakMargin,
    machine,
    productionMonth,
    yieldPerSheet,
    rawFilename: filename,
  };
}

/**
 * Converte uma ficha técnica do SISMAT em um objeto oficial ServiceOrder
 */
export function converterFichaEmServiceOrder(
  ficha: SismatFichaTecnica,
  papersCatalog: PaperFactory[],
  formatsCatalog: CutFormat[],
  servicesCatalog: ServiceCatalog[]
): {
  order: ServiceOrder;
  neededPaper?: PaperFactory;
  neededFormat?: CutFormat;
  neededService?: ServiceCatalog;
} {
  const orderNumber = `#${ficha.bsYear}-${ficha.bsNumber.padStart(4, '0')}`;
  const id = `sismat-${ficha.bsYear}-${ficha.bsNumber}-${normalizeMaterialCode(ficha.materialCode)}`;

  // 1. Vincula Papel
  let paper = papersCatalog.find(
    (p) =>
      p.code === ficha.paperCode ||
      p.name.toLowerCase().includes(ficha.paperName.toLowerCase().slice(0, 15))
  );
  let neededPaper: PaperFactory | undefined;
  if (!paper) {
    neededPaper = {
      id: `pap-${ficha.paperCode.toLowerCase()}`,
      code: ficha.paperCode,
      name: ficha.paperName,
      widthMm: ficha.paperWidthMm,
      heightMm: ficha.paperHeightMm,
      packageSheets: ficha.packageSheets,
      grammage: 75,
      color: ficha.paperName.includes('Azul') ? 'Azul' : ficha.paperName.includes('Kraft') ? 'Pardo' : 'Branco',
      description: `Papel SISMAT: ${ficha.paperName}`,
    };
    paper = neededPaper;
  }

  // 2. Vincula Formato de Corte
  let format = formatsCatalog.find(
    (f) =>
      (f.widthMm === ficha.cutWidthMm && f.heightMm === ficha.cutHeightMm) ||
      (f.widthMm === ficha.cutHeightMm && f.heightMm === ficha.cutWidthMm)
  );
  let neededFormat: CutFormat | undefined;
  if (!format) {
    neededFormat = {
      id: `fmt-${ficha.cutWidthMm}x${ficha.cutHeightMm}`,
      name: `${ficha.cutWidthMm}×${ficha.cutHeightMm} mm`,
      widthMm: ficha.cutWidthMm,
      heightMm: ficha.cutHeightMm,
      description: `Formato SISMAT: ${ficha.formato}`,
    };
    format = neededFormat;
  }

  // 3. Vincula Serviço
  const cleanCode = normalizeMaterialCode(ficha.materialCode);
  let service = servicesCatalog.find((s) => normalizeMaterialCode(s.code) === cleanCode);
  let neededService: ServiceCatalog | undefined;
  if (!service) {
    let category = 'IMP';
    if (ficha.trabalho.toLowerCase().includes('capa')) category = 'CAPA';
    else if (ficha.trabalho.toLowerCase().includes('ficha')) category = 'FICHAS';
    else if (ficha.trabalho.toLowerCase().includes('livro')) category = 'LIVROS';
    else if (ficha.trabalho.toLowerCase().includes('correio') || ficha.trabalho.toLowerCase().includes('ar'))
      category = 'CORREIOS';

    neededService = {
      id: `srv-${cleanCode}`,
      code: ficha.materialCode,
      name: ficha.trabalho,
      category,
      description: `Ficha SISMAT BS ${ficha.bsNumber}/${ficha.bsYear}`,
    };
    service = neededService;
  }

  // Cálculo Gráfico Oficial
  const math = calculateOrderMath({
    blocksQty: ficha.blocksQty,
    sheetsPerBlock: ficha.sheetsPerBlock,
    ways: ficha.ways,
    imagesPerPlate: ficha.imagesPerPlate || 1,
    breakMargin: ficha.breakMargin,
    sheetW: paper.widthMm,
    sheetH: paper.heightMm,
    cutW: format.widthMm,
    cutH: format.heightMm,
  });

  const packagesCount =
    paper.packageSheets > 0
      ? Math.round((math.totalFactorySheetsUsed / paper.packageSheets) * 10) / 10
      : 0;

  const now = Date.now();
  const order: ServiceOrder = {
    id,
    orderNumber,
    productionMonth: ficha.productionMonth,
    dateEmission: ficha.productionMonth,
    createdBy: 'DIGRA / SISMAT',
    machine: ficha.machine,
    status: 'Pronto' as OrderStatus,
    observation: `Importado via SISMAT (${ficha.rawFilename}). Formato original: ${ficha.formato}`,
    serviceId: service.id,
    serviceCode: service.code,
    serviceName: ficha.trabalho,
    serviceCategory: service.category,
    paperId: paper.id,
    paperCode: paper.code,
    paperName: paper.name,
    paperWidthMm: paper.widthMm,
    paperHeightMm: paper.heightMm,
    packageSheets: paper.packageSheets,
    cutFormatId: format.id,
    cutFormatName: format.name,
    cutWidthMm: format.widthMm,
    cutHeightMm: format.heightMm,
    blocksQty: ficha.blocksQty,
    sheetsPerBlock: ficha.sheetsPerBlock,
    ways: ficha.ways,
    imagesPerPlate: ficha.imagesPerPlate || 1,
    breakMargin: ficha.breakMargin,
    totalFinalSheets: math.totalFinalSheets,
    yieldPerSheet: ficha.yieldPerSheet || math.yieldPerSheet,
    cutsDescription: math.cutsDescription,
    fullSheetsNeeded: math.fullSheetsNeeded,
    totalFactorySheetsUsed: math.totalFactorySheetsUsed,
    packagesCount,
    efficiencyPercent: math.efficiencyPercent,
    createdAt: now,
    updatedAt: now,
  };

  return { order, neededPaper, neededFormat, neededService };
}

/**
 * Lê todas as planilhas das pastas locais em ambiente Node.js
 * Executado quando rodado via CLI (ex: `npx tsx src/utils/importadorSismat.ts`)
 */
export async function processarPastasLocaisNode(
  pastas: string[] = ['importador_digra/arquivos_excel/2025', 'importador_digra/arquivos_excel/2026']
): Promise<SismatFichaTecnica[]> {
  if (typeof window !== 'undefined') {
    // Em navegador, retorna o dataset pré-carregado
    return (sismatPreloadData as SismatFichaTecnica[]) || [];
  }

  try {
    const fs = await import('fs');
    const path = await import('path');

    const fichas: SismatFichaTecnica[] = [];

    for (const dir of pastas) {
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.xlsx'));
      console.info(`[SISMAT] Lendo diretório '${dir}': ${files.length} planilhas encontradas.`);

      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          const wb = xlsxLib.readFile(fullPath);
          const sheetName = wb.SheetNames[0];
          const sheet = wb.Sheets[sheetName];
          const ficha = extrairDadosPlanilha(sheet, file);
          fichas.push(ficha);
        } catch (err) {
          console.error(`[SISMAT] Erro ao ler planilha ${file}:`, err);
        }
      }
    }

    return fichas;
  } catch (err) {
    console.warn('[SISMAT] Ambiente sem acesso a node:fs. Usando preload.', err);
    return (sismatPreloadData as SismatFichaTecnica[]) || [];
  }
}

/**
 * Função Principal: carregarHistoricoSismat()
 * Roda uma única vez na inicialização do sistema:
 * 1. Injeta todas as fichas técnicas no estado local
 * 2. Salva o histórico completo direto no Firebase Firestore
 */
export async function carregarHistoricoSismat(options?: {
  force?: boolean;
  onProgress?: (current: number, total: number) => void;
}): Promise<{
  success: boolean;
  totalImported: number;
  orders: ServiceOrder[];
  services: ServiceCatalog[];
  formats: CutFormat[];
  papers: PaperFactory[];
}> {
  const isAlreadyImported = !options?.force && Boolean(localStorage.getItem(SISMAT_IMPORT_KEY));

  // Obtém registros pré-processados das pastas 2025 e 2026
  let fichas: SismatFichaTecnica[] = (sismatPreloadData as SismatFichaTecnica[]) || [];

  if (fichas.length === 0 && typeof window === 'undefined') {
    fichas = await processarPastasLocaisNode();
  }

  if (fichas.length === 0) {
    console.warn('[SISMAT] Nenhuma ficha encontrada para importar.');
    return { success: false, totalImported: 0, orders: [], services: [], formats: [], papers: [] };
  }

  // Carrega catálogos atuais do localStorage para não duplicar
  const currentPapers: PaperFactory[] = (() => {
    try {
      if (typeof localStorage === 'undefined') return [];
      const saved = localStorage.getItem('pjerj_digra_papers_v7');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })();

  const currentFormats: CutFormat[] = (() => {
    try {
      if (typeof localStorage === 'undefined') return [];
      const saved = localStorage.getItem('pjerj_digra_formats_v7');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })();

  const currentServices: ServiceCatalog[] = (() => {
    try {
      if (typeof localStorage === 'undefined') return [];
      const saved = localStorage.getItem('pjerj_digra_services_v7');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })();

  const currentOrders: ServiceOrder[] = (() => {
    try {
      if (typeof localStorage === 'undefined') return [];
      const saved = localStorage.getItem('pjerj_digra_orders_v7');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })();

  const newOrders: ServiceOrder[] = [];
  const newServicesMap = new Map<string, ServiceCatalog>();
  const newFormatsMap = new Map<string, CutFormat>();
  const newPapersMap = new Map<string, PaperFactory>();

  // Processa todas as 166+ planilhas
  for (const ficha of fichas) {
    const { order, neededPaper, neededFormat, neededService } = converterFichaEmServiceOrder(
      ficha,
      [...currentPapers, ...Array.from(newPapersMap.values())],
      [...currentFormats, ...Array.from(newFormatsMap.values())],
      [...currentServices, ...Array.from(newServicesMap.values())]
    );

    newOrders.push(order);
    if (neededPaper && !newPapersMap.has(neededPaper.id)) {
      newPapersMap.set(neededPaper.id, neededPaper);
    }
    if (neededFormat && !newFormatsMap.has(neededFormat.id)) {
      newFormatsMap.set(neededFormat.id, neededFormat);
    }
    if (neededService && !newServicesMap.has(neededService.id)) {
      newServicesMap.set(neededService.id, neededService);
    }
  }

  // Mescla com registros existentes sem duplicar ordens com mesmo orderNumber
  const existingOrderNumbers = new Set(currentOrders.map((o) => o.orderNumber));
  const uniqueIncomingOrders = newOrders.filter((o) => !existingOrderNumbers.has(o.orderNumber));
  const mergedOrders = [...currentOrders, ...uniqueIncomingOrders];

  const mergedServices = [...currentServices];
  for (const s of newServicesMap.values()) {
    if (!mergedServices.some((curr) => curr.id === s.id || curr.code === s.code)) {
      mergedServices.push(s);
    }
  }

  const mergedFormats = [...currentFormats];
  for (const f of newFormatsMap.values()) {
    if (!mergedFormats.some((curr) => curr.id === f.id || (curr.widthMm === f.widthMm && curr.heightMm === f.heightMm))) {
      mergedFormats.push(f);
    }
  }

  const mergedPapers = [...currentPapers];
  for (const p of newPapersMap.values()) {
    if (!mergedPapers.some((curr) => curr.id === p.id || curr.code === p.code)) {
      mergedPapers.push(p);
    }
  }

  // 1. Injeta no estado local (localStorage e canais de sincronização)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pjerj_digra_orders_v7', JSON.stringify(mergedOrders));
      localStorage.setItem('pjerj_digra_services_v7', JSON.stringify(mergedServices));
      localStorage.setItem('pjerj_digra_formats_v7', JSON.stringify(mergedFormats));
      localStorage.setItem('pjerj_digra_papers_v7', JSON.stringify(mergedPapers));
      localStorage.setItem(SISMAT_IMPORT_KEY, JSON.stringify({ importedAt: Date.now(), total: uniqueIncomingOrders.length }));
    }
  } catch (err) {
    console.error('[SISMAT] Erro ao persistir dados locais:', err);
  }

  // 2. Salva o histórico completo direto no Firebase Firestore
  if (isFirebaseConfigured && db) {
    try {
      console.info(`[SISMAT] Salvando ${uniqueIncomingOrders.length} O.S. no Firebase Firestore...`);
      // Salva de forma assíncrona sem bloquear
      Promise.all(
        uniqueIncomingOrders.map((ord) => setDoc(doc(db!, 'orders', ord.id), ord, { merge: true }))
      ).then(() => {
        console.info('[SISMAT] Histórico completo salvo com sucesso no Firebase Firestore.');
      }).catch((e) => {
        console.error('[SISMAT] Erro ao salvar ordens no Firestore:', e);
      });

      // Salva também serviços novos
      Promise.all(
        Array.from(newServicesMap.values()).map((srv) =>
          setDoc(doc(db!, 'services', srv.id), srv, { merge: true })
        )
      ).catch((e) => console.error('[SISMAT] Erro ao salvar serviços no Firestore:', e));
    } catch (e) {
      console.error('[SISMAT] Erro na inicialização Firestore:', e);
    }
  }

  console.info(`[SISMAT] Importação concluída: ${uniqueIncomingOrders.length} O.S. novas injetadas.`);

  return {
    success: true,
    totalImported: uniqueIncomingOrders.length,
    orders: mergedOrders,
    services: mergedServices,
    formats: mergedFormats,
    papers: mergedPapers,
  };
}

/**
 * LÓGICA DE APRENDIZADO CONTÍNUO:
 * Busca a O.S. mais recente vinculada a um código de material.
 * Ordena por data de atualização (updatedAt), criação (createdAt), ou ano/número do BS.
 */
export function buscarUltimaOSPorCodigo(
  codigo: string,
  ordersList: ServiceOrder[]
): ServiceOrder | null {
  const clean = normalizeMaterialCode(codigo);
  if (!clean || clean.length < 3) return null;

  // Filtra todas as O.S. que contenham o código do material
  const candidatas = ordersList.filter((ord) => {
    const ordCodeClean = normalizeMaterialCode(ord.serviceCode);
    const ordServiceIdClean = normalizeMaterialCode(ord.serviceId);
    return ordCodeClean === clean || ordServiceIdClean === clean || ordCodeClean.includes(clean);
  });

  if (candidatas.length === 0) return null;

  // Ordena para obter a alteração mais recente feita
  candidatas.sort((a, b) => {
    // 1. Mais recente por timestamp de alteração
    const timeA = a.updatedAt || a.createdAt || 0;
    const timeB = b.updatedAt || b.createdAt || 0;
    if (timeA !== timeB) return timeB - timeA;

    // 2. Fallback pelo número e ano da O.S. (#2026-0167 > #2026-0006 > #2025-0750)
    const numA = parseInt((a.orderNumber || '').replace(/[^0-9]/g, ''), 10) || 0;
    const numB = parseInt((b.orderNumber || '').replace(/[^0-9]/g, ''), 10) || 0;
    return numB - numA;
  });

  return candidatas[0];
}

/**
 * LÓGICA DE APRENDIZADO CONTÍNUO:
 * Ao digitar qualquer código, retorna os parâmetros da O.S. mais recente desse código
 * para autocompletar Papel, Formato de Corte, Quantidade e Sobra.
 */
export function obterParametrosAprendizadoContinuo(
  codigo: string,
  ordersList: ServiceOrder[],
  papersList: PaperFactory[],
  formatsList: CutFormat[]
): {
  found: boolean;
  order: ServiceOrder | null;
  paperId: string;
  cutFormatId: string;
  blocksQty: number;
  sheetsPerBlock: number;
  ways: number;
  imagesPerPlate: number;
  breakMargin: number;
  machine: string;
  sourceDescription: string;
} | null {
  const clean = normalizeMaterialCode(codigo);
  const ultimaOS = buscarUltimaOSPorCodigo(codigo, ordersList);

  if (!ultimaOS) {
    // Fallback: Busca na base estática consolidada fichas_tecnicas.json
    const ficha =
      (fichasTecnicasRaw as Record<string, any>)[codigo] ||
      Object.values(fichasTecnicasRaw as Record<string, any>).find(
        (f: any) => normalizeMaterialCode(f.codigo) === clean
      );

    if (ficha) {
      // Localiza papel adequado
      const pName = (ficha.papel || '').toLowerCase();
      let matchedPaper = papersList.find((p) => p.name.toLowerCase().includes(pName));
      if (!matchedPaper) {
        if (pName.includes('adesiv')) matchedPaper = papersList.find((p) => p.code === 'AD-180');
        else if (pName.includes('kraft')) matchedPaper = papersList.find((p) => p.code === 'KRF-110');
        else if (pName.includes('couche') || pName.includes('couché')) matchedPaper = papersList.find((p) => p.code === 'COU-150');
        else if (pName.includes('cartao') || pName.includes('cartão') || pName.includes('triplex')) matchedPaper = papersList.find((p) => p.code === 'TR-250');
        else matchedPaper = papersList.find((p) => p.code === 'OFF-75') || papersList[0];
      }

      // Localiza formato de corte adequado
      const fName = (ficha.formatoCorte || '').toLowerCase();
      let matchedFormat = formatsList.find((f) => f.name.toLowerCase() === fName);
      if (!matchedFormat) {
        if (fName.includes('40x60') || fName.includes('40 x 60')) matchedFormat = formatsList.find((f) => f.name.includes('40x60') || f.name.includes('120×70')) || formatsList[0];
        else if (fName.includes('a5') || fName.includes('148x210') || fName.includes('210x148')) matchedFormat = formatsList.find((f) => f.name === 'A5');
        else if (fName.includes('1/3') || fName.includes('210x105')) matchedFormat = formatsList.find((f) => f.name === '1/3 A4');
        else if (fName.includes('a6') || fName.includes('105x148')) matchedFormat = formatsList.find((f) => f.name === 'A6');
        else matchedFormat = formatsList.find((f) => f.name === 'A4') || formatsList[0];
      }

      return {
        found: true,
        order: null,
        paperId: matchedPaper?.id || papersList[0]?.id || '',
        cutFormatId: matchedFormat?.id || formatsList[0]?.id || '',
        blocksQty: 10,
        sheetsPerBlock: 50,
        ways: 1,
        imagesPerPlate: 1,
        breakMargin: 10,
        machine: 'Heidelberg Bicolor',
        sourceDescription: `Ficha Técnica SISMAT - ${ficha.descricao}`,
      };
    }

    return null;
  }

  // Localiza o papel correspondente
  let matchedPaperId = ultimaOS.paperId;
  if (!papersList.some((p) => p.id === matchedPaperId)) {
    const fallbackPaper = papersList.find(
      (p) => p.code === ultimaOS.paperCode || p.name.toLowerCase() === ultimaOS.paperName.toLowerCase()
    );
    if (fallbackPaper) matchedPaperId = fallbackPaper.id;
  }

  // Localiza o formato de corte correspondente
  let matchedFormatId = ultimaOS.cutFormatId;
  if (!formatsList.some((f) => f.id === matchedFormatId)) {
    const fallbackFormat = formatsList.find(
      (f) =>
        (f.widthMm === ultimaOS.cutWidthMm && f.heightMm === ultimaOS.cutHeightMm) ||
        (f.widthMm === ultimaOS.cutHeightMm && f.heightMm === ultimaOS.cutWidthMm)
    );
    if (fallbackFormat) matchedFormatId = fallbackFormat.id;
  }

  return {
    found: true,
    order: ultimaOS,
    paperId: matchedPaperId,
    cutFormatId: matchedFormatId,
    blocksQty: ultimaOS.blocksQty,
    sheetsPerBlock: ultimaOS.sheetsPerBlock || 50,
    ways: ultimaOS.ways || 1,
    imagesPerPlate: ultimaOS.imagesPerPlate || 1,
    breakMargin: ultimaOS.breakMargin, // Sobra de corte
    machine: ultimaOS.machine,
    sourceDescription: `O.S. ${ultimaOS.orderNumber} (${ultimaOS.productionMonth || 'Recente'}) - ${ultimaOS.serviceName}`,
  };
}

// Execução direta em CLI caso chamado por node/tsx
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  const isDirectRun = process.argv[1]?.includes('importadorSismat');
  if (isDirectRun) {
    console.info('[SISMAT CLI] Iniciando processamento em lote das pastas 2025 e 2026...');
    processarPastasLocaisNode().then(async (fichas) => {
      console.info(`[SISMAT CLI] Sucesso: ${fichas.length} planilhas processadas.`);
      try {
        const fs = await import('fs');
        const path = await import('path');
        const targetPath = path.resolve('src/data/sismatHistoricoPreload.json');
        fs.writeFileSync(targetPath, JSON.stringify(fichas, null, 2), 'utf-8');
        console.info(`[SISMAT CLI] Base de dados pré-carregada salva em: ${targetPath}`);
      } catch (err) {
        console.warn('[SISMAT CLI] Não foi possível salvar o arquivo de preload:', err);
      }
    });
  }
}
