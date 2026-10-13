export type MachineType = 'Heidelberg Bicolor' | 'Sakurai' | string;

export type OrderStatus =
  | 'Aguardando Início'
  | 'Em Impressão'
  | 'Em Corte'
  | 'Em Acabamento'
  | 'Pronto';

export type PriorityType = 'Normal' | 'Urgente' | 'Alta Prioridade';

export type ServiceCategoryType = 'CORREIOS' | 'IMP' | 'CAPA' | 'FICHAS' | 'LIVROS' | string;

export interface PaperFactory {
  id: string;
  code: string;
  name: string;
  widthMm: number;
  heightMm: number;
  grammage?: number;
  packageSheets: number;
  color?: string;
  description?: string;
}

export interface CutFormat {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  description?: string;
}

export interface ServiceCatalog {
  id: string;
  code: string; // Ex: 654-5125, 655-8753
  name: string; // Descrição do Trabalho
  category: ServiceCategoryType; // CORREIOS, IMP, CAPA, FICHAS, LIVROS
  description?: string;
  codigo?: string;
  descricao?: string;
  categoria?: string;
}

export interface Responsible {
  id: string;
  name: string;
  role?: string;
}

export interface Machine {
  id: string;
  name: string;
  tech?: string;
}

export interface CutCalculationResult {
  yield: number;
  orientation: 'direct' | 'rotated' | 'mixed';
  cols: number;
  rows: number;
  rotatedCols?: number;
  rotatedRows?: number;
  efficiencyPercent: number;
  wastePercent: number;
  description: string;
  schematic: {
    sheetW: number;
    sheetH: number;
    cutW: number;
    cutH: number;
    cuts: Array<{ x: number; y: number; w: number; h: number; rotated: boolean }>;
  };
}

export type MaterialType =
  | 'PACOTE'
  | 'BLOCO'
  | 'FICHA'
  | 'ETIQUETA'
  | 'CAPA'
  | 'OUTROS';

export interface ServiceOrder {
  id: string;
  orderNumber: string; // ex: "BS 17 - 654-5125" ou "#2026-0001"
  bsNumber?: number | string; // Número do Boletim de Serviço (BS) digitado pelo operador (ex: 17)
  bsCodeKey?: string; // Chave oficial associada: "BS [Número] - [CódigoDoMaterial]"
  productionMonth?: string; // Mês de Produção (ex: "Outubro / 2026")
  dateEmission?: string; // Data de emissão (legado)
  createdBy: string; // Responsável (FLÁVIO, ENÉIAS, RICARDO)
  machine: string; // Heidelberg Bicolor, Sakurai
  priority?: PriorityType; // Prioridade (descontinuado)
  status: OrderStatus;
  observation?: string;

  // Serviço & Categoria Oficial (Busca Inteligente)
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  serviceCategory: ServiceCategoryType;

  // Papel de Fábrica
  paperId: string;
  paperCode: string;
  paperName: string;
  paperWidthMm: number;
  paperHeightMm: number;
  packageSheets: number;

  // Formato de Corte (Corte para Impressão - Motor de Cálculo Gráfico)
  cutFormatId: string;
  cutFormatName: string;
  cutWidthMm: number;
  cutHeightMm: number;

  // Corte Final (Tamanho do Trabalho / Refile Produto Acabado, ex: "105x74 mm")
  finalCutSize?: string;

  // Entradas de Produção
  blocksQty: number; // Quantidade de Blocos/Pacotes/Unidades
  sheetsPerBlock: number; // Folhas por Bloco (compatibilidade legado)
  ways: number; // Vias
  wayColors?: string[]; // Cores de cada via (Via 1 sempre Branca, demais customizadas)
  imagesPerPlate: number; // Imagens por Folha/Chapa (divisor)
  breakMargin: number; // Margem de quebra / Sobra legado (folhas)

  // Novos Campos de Produção & Matemática Gráfica
  materialType?: MaterialType; // PACOTE, BLOCO, FICHA, ETIQUETA, CAPA, OUTROS
  unitMultiplier?: number; // Folhas por bloco ou Unidades por pacote (ou 1)
  surplusPercent?: number; // Porcentagem de Sobra (Acerto), padrão 10%
  surplusSheets?: number; // Sobra calculada em folhas de impressão
  totalPrintedSheets?: number; // Folhas líquidas + sobra
  calcFormulaDescription?: string; // Memória de cálculo resumida
  colorBreakdown?: {
    color: string;
    waysCount: number;
    printedSheets: number;
    liquidSheets: number;
    surplusSheets: number;
    totalColorSheets: number;
  }[];

  // Cálculos Automáticos de Produção
  totalFinalSheets: number; // Folhas líquidas impressas
  yieldPerSheet: number; // Aproveitamento do papel
  cutsDescription: string;
  fullSheetsNeeded: number; // Math.ceil(totalFinalSheets / yieldPerSheet)
  totalFactorySheetsUsed: number; // fullSheetsNeeded + sobra de fábrica
  packagesCount: number; // totalFactorySheetsUsed / packageSheets
  efficiencyPercent: number;

  createdAt: number;
  updatedAt: number;
}
