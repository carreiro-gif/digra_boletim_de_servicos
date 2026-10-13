import React, { useState, useMemo } from 'react';
import { useGraphic } from '../context/GraphicContext';
import {
  calculateCutYield,
  calculateOrderMath,
  getCurrentProductionMonth,
  getProductionMonthOptions,
  MONTHS_PT,
} from '../utils/graphicMath';
import { PRINT_CUT_FORMATS } from '../data/initialData.ts';
import { CuttingSchematic } from './CuttingSchematic';
import { PjerjLogo } from './PjerjLogo';
import { ServiceOrder, MaterialType } from '../types';
import {
  obterParametrosAprendizadoContinuo,
} from '../utils/importadorSismat';
import {
  FileText,
  Printer,
  CheckCircle2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Edit3,
  AlertTriangle,
  X,
  Calendar,
  CalendarDays,
  Sparkles,
  Check,
} from 'lucide-react';

export const MATERIAL_OPTIONS: MaterialType[] = [
  'PACOTE',
  'BLOCO',
  'FICHA',
  'ETIQUETA',
  'OUTROS',
];

interface OrderEmissionViewProps {
  onPrintOrder: (order: ServiceOrder) => void;
  onNavigateKanban: () => void;
  orderToEdit?: ServiceOrder | null;
  onClearOrderToEdit?: () => void;
}

export const OrderEmissionView: React.FC<OrderEmissionViewProps> = ({
  onPrintOrder,
  onNavigateKanban,
  orderToEdit,
  onClearOrderToEdit,
}) => {
  const {
    orders,
    papers,
    formats,
    services,
    responsibles,
    machines,
    addOrder,
    updateOrder,
    deleteOrder,
    getNextOrderNumber,
    isFirebaseActive,
  } = useGraphic();

  // Opções de sugestão para o Mês de Produção
  const productionMonthOptions = useMemo(() => getProductionMonthOptions(), []);

  // Modo Edição: armazena o id da O.S. sendo editada, ou null para nova O.S.
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form State: Mês de produção autopreenchido de forma inteligente (ex: "Outubro / 2026")
  const [bsNumber, setBsNumber] = useState<string>(''); // Campo visual e obrigatório do Boletim de Serviço (BS)
  const [orderNumber, setOrderNumber] = useState<string>(() => getNextOrderNumber());
  const [productionMonth, setProductionMonth] = useState<string>(() => getCurrentProductionMonth());
  const [createdBy, setCreatedBy] = useState<string>('');
  const [machine, setMachine] = useState<string>('');
  const [observation, setObservation] = useState<string>('');

  // Seletor Visual de Mês e Ano de Produção (com calendário, todos os 12 meses e opção de anos)
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => {
    const match = (productionMonth || '').match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : new Date().getFullYear();
  });

  const openMonthPicker = () => {
    const match = (productionMonth || '').match(/(\d{4})/);
    if (match) {
      setPickerYear(parseInt(match[1], 10));
    } else {
      setPickerYear(new Date().getFullYear());
    }
    setIsMonthPickerOpen(true);
  };

  const handleSelectMonth = (monthName: string, year: number) => {
    setProductionMonth(`${monthName} / ${year}`);
    if (validationError) setValidationError(null);
    setIsMonthPickerOpen(false);
  };

  // Busca Inteligente de Código (Ignorando traços / hífens)
  const [serviceCodeInput, setServiceCodeInput] = useState<string>('');

  // Papel, Corte para Impressão e Corte Final (Produto Acabado)
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');
  const [finalCutSize, setFinalCutSize] = useState<string>(''); // Corte Final (Tamanho do Trabalho / Refile Produto Acabado)

  // Entradas de Produção (Padrão 'OUTROS' com multiplicador 1 para nunca travar o cálculo)
  const [materialType, setMaterialType] = useState<MaterialType>('OUTROS');
  const [blocksQty, setBlocksQty] = useState<number | ''>('');
  const [sheetsPerBlock, setSheetsPerBlock] = useState<number | ''>(100);
  const [unitsPerPackage, setUnitsPerPackage] = useState<number | ''>(100);
  const [ways, setWays] = useState<number | ''>(1);
  const [wayColors, setWayColors] = useState<string[]>(['Branca']); // Via 1 fixa "Branca", via 2+ editável
  const [imagesPerPlate, setImagesPerPlate] = useState<number | ''>('');
  const [surplusPercent, setSurplusPercent] = useState<number | ''>(10); // Sobra (Acerto) % (padrão 10%, editável)

  // Sugestões rápidas de cores comuns de vias
  const COMMON_WAY_COLORS = ['Azul', 'Rosa', 'Verde', 'Amarela', 'Palha', 'Branca', 'Canário', 'Salmão'];

  // Lógica de Aprendizado Contínuo
  const [learningInfo, setLearningInfo] = useState<{
    orderNumber: string;
    productionMonth: string;
    paperName: string;
    cutFormatName: string;
    finalCutSize: string;
    blocksQty: number;
    breakMargin: number;
    machine: string;
  } | null>(null);
  const lastAppliedCodeRef = React.useRef<string>('');

  // Mensagens e Toasts
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Normalização de código para ignorar traços, pontos e espaços
  const normalizeCode = (val: string) => val.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();

  // Localização Inteligente do Serviço no catálogo
  const matchedService = useMemo(() => {
    const clean = normalizeCode(serviceCodeInput);
    if (!clean) return null;
    return (
      services.find((s) => {
        const sCodeClean = normalizeCode(s.code);
        return sCodeClean === clean || sCodeClean.includes(clean);
      }) || null
    );
  }, [services, serviceCodeInput]);

  // Chave Oficial: "BS [Número] - [CódigoDoMaterial]" (Exemplo: BS 17 - 654-5125)
  const officialBsKey = useMemo(() => {
    const num = bsNumber.trim();
    if (!num) return '';
    const code = matchedService ? matchedService.code : serviceCodeInput.trim();
    return code ? `BS ${num} - ${code}` : `BS ${num}`;
  }, [bsNumber, matchedService, serviceCodeInput]);

  // LÓGICA DE APRENDIZADO CONTÍNUO:
  // Ao digitar qualquer código no formulário, busca o histórico para autocompletar Papel, Corte para Impressão e Corte Final.
  // Regra 1: Quantidade, tipo de material, Vias, Imagens/Chapa e Sobra devem voltar ao estado inicial.
  // NÃO preencha esses campos com dados do histórico de O.S. anteriores.
  React.useEffect(() => {
    const clean = normalizeCode(serviceCodeInput);
    if (!clean || clean.length < 3) {
      setLearningInfo(null);
      return;
    }

    // Se estiver editando uma O.S. já existente, não sobrescrever automaticamente
    if (editingOrderId) {
      return;
    }

    if (lastAppliedCodeRef.current === clean) {
      return;
    }

    // 1) CAMPOS ZERADOS A CADA MATERIAL:
    // Quando escolher ou digitar um novo código, os campos Quantidade, tipo de material,
    // Vias, Imagens/Chapa e Sobra voltam ao estado inicial ('OUTROS'). Quantidade e Imagens/Chapa ficam vazios.
    setBlocksQty('');
    setMaterialType('OUTROS');
    setSheetsPerBlock(100);
    setUnitsPerPackage(100);
    setWays(1);
    setWayColors(['Branca']);
    setImagesPerPlate('');
    setSurplusPercent(10);

    const svc = services.find((s) => {
      const sCodeClean = normalizeCode(s.code || (s as any).codigo || '');
      return sCodeClean === clean || sCodeClean.includes(clean);
    });

    const aprendizado = obterParametrosAprendizadoContinuo(clean, orders, papers, PRINT_CUT_FORMATS);

    // 2) CAPAS AUTOMÁTICAS:
    // Quando o material escolhido for uma capa (categoria que contenha "CAPA" ou nome que comece com "Capa"),
    // marque automaticamente o tipo PACOTE (com 100 unidades por pacote, editável), além de preencher
    // Corte para Impressão SRA3 (328x480 mm) e Corte Final 320x460 mm como já está. Tudo continua editável.
    const isCapa = Boolean(
      (svc && (
        (svc.category && svc.category.toUpperCase().includes('CAPA')) ||
        (svc.name && svc.name.trim().toLowerCase().startsWith('capa')) ||
        ((svc as any).categoria && String((svc as any).categoria).toUpperCase().includes('CAPA')) ||
        ((svc as any).descricao && String((svc as any).descricao).trim().toLowerCase().startsWith('capa'))
      )) ||
      (aprendizado?.order && (
        (aprendizado.order.serviceCategory && aprendizado.order.serviceCategory.toUpperCase().includes('CAPA')) ||
        (aprendizado.order.serviceName && aprendizado.order.serviceName.trim().toLowerCase().startsWith('capa'))
      ))
    );

    const sra3Format = PRINT_CUT_FORMATS.find(
      (f) => f.name.toUpperCase() === 'SRA3' || f.id === 'fmt-sra3' || (f.widthMm === 328 && f.heightMm === 480)
    );

    if (isCapa) {
      lastAppliedCodeRef.current = clean;
      setMaterialType('PACOTE');
      setUnitsPerPackage(100);
      if (sra3Format) {
        setSelectedFormatId(sra3Format.id);
      }
      setFinalCutSize('320x460 mm');
      if (aprendizado && aprendizado.found) {
        if (aprendizado.paperId) setSelectedPaperId(aprendizado.paperId);
        if (aprendizado.machine && !machine) setMachine(aprendizado.machine);
      }

      const paperObj = papers.find((p) => p.id === (aprendizado?.paperId || selectedPaperId));

      setLearningInfo({
        orderNumber: aprendizado?.order?.orderNumber || 'Padrão Automático Capa SRA3',
        productionMonth: aprendizado?.order?.productionMonth || 'Histórico Consolidado',
        paperName: aprendizado?.order?.paperName || paperObj?.name || '',
        cutFormatName: 'SRA3 (328×480 mm)',
        finalCutSize: '320x460 mm',
        blocksQty: 0,
        breakMargin: 10,
        machine: aprendizado?.machine || machine,
      });
    } else {
      setMaterialType('OUTROS');
      if (aprendizado && aprendizado.found) {
        lastAppliedCodeRef.current = clean;
        // O autopreenchimento pelo histórico continua só para Papel, Corte para Impressão e Corte Final
        if (aprendizado.paperId) setSelectedPaperId(aprendizado.paperId);
        if (aprendizado.cutFormatId) setSelectedFormatId(aprendizado.cutFormatId);
        if (aprendizado.finalCutSize !== undefined) setFinalCutSize(aprendizado.finalCutSize);
        if (aprendizado.machine && !machine) setMachine(aprendizado.machine);

        const paperObj = papers.find((p) => p.id === aprendizado.paperId);
        const formatObj = PRINT_CUT_FORMATS.find((f) => f.id === aprendizado.cutFormatId) || formats.find((f) => f.id === aprendizado.cutFormatId);

        setLearningInfo({
          orderNumber: aprendizado.order?.orderNumber || 'Ficha SISMAT Oficial',
          productionMonth: aprendizado.order?.productionMonth || 'Histórico Consolidado',
          paperName: aprendizado.order?.paperName || paperObj?.name || '',
          cutFormatName: aprendizado.order?.cutFormatName || formatObj?.name || '',
          finalCutSize: aprendizado.finalCutSize || '',
          blocksQty: 0,
          breakMargin: 10,
          machine: aprendizado.machine,
        });
      } else {
        lastAppliedCodeRef.current = clean;
        setLearningInfo(null);
      }
    }
  }, [serviceCodeInput, orders, papers, formats, services, editingOrderId, machine]);

  // Reset total do formulário para nova O.S. (com Mês de Produção inteligente do sistema)
  const resetFormToBlank = () => {
    onClearOrderToEdit?.();
    setEditingOrderId(null);
    setBsNumber('');
    setProductionMonth(getCurrentProductionMonth());
    setCreatedBy('');
    setMachine('');
    setObservation('');
    setServiceCodeInput('');
    setSelectedPaperId('');
    setSelectedFormatId('');
    setFinalCutSize('');
    setBlocksQty('');
    setMaterialType('OUTROS');
    setSheetsPerBlock(100);
    setUnitsPerPackage(100);
    setWays(1);
    setWayColors(['Branca']);
    setImagesPerPlate('');
    setSurplusPercent(10);
    setValidationError(null);
    setLearningInfo(null);
    lastAppliedCodeRef.current = '';
    setOrderNumber(getNextOrderNumber());
  };

  // Papel e Formato selecionados (Formato estritamente dentre as 12 opções de Corte para Impressão)
  const activePaper = useMemo(() => {
    return papers.find((p) => p.id === selectedPaperId) || null;
  }, [papers, selectedPaperId]);

  const activeFormat = useMemo(() => {
    return PRINT_CUT_FORMATS.find((f) => f.id === selectedFormatId) || formats.find((f) => f.id === selectedFormatId) || null;
  }, [formats, selectedFormatId]);

  // Cálculo Gráfico em Tempo Real com Tipo de Material e Sobra (Acerto) em Porcentagem:
  // - O tipo de material vem com 'OUTROS' marcado por padrão (multiplicador 1).
  // - Valores vazios, nulos, NaN ou 0 em multiplicador/vias/imagens são tratados como 1 internamente.
  // - Quantidade e Imagens/Chapa são obrigatórias (a matemática mostra 0 enquanto não preenchidos).
  // - Unidades totais = Quantidade × multiplicador do tipo (folhas por bloco, unidades por pacote, ou 1).
  // - Para cada via: folhas impressas = unidades totais ÷ imagens por chapa. Some as vias de mesma cor.
  // - Aproveitamento (poses por folha): compara orientação normal e girada em 90° e adota a maior.
  // - Para cada cor: folhas líquidas = Math.ceil(folhas impressas da cor ÷ poses); sobra = Math.ceil(líquidas × % sobra ÷ 100); total = líquidas + sobra.
  // - Gasto Total de Papel = soma dos totais de todas as cores.
  const calculation = useMemo(() => {
    const qty = Number(blocksQty) || 0;
    const imgs = Number(imagesPerPlate) || 0;
    const w = Math.max(1, Number(ways) || 1);
    const surplus = surplusPercent === '' ? 10 : Number(surplusPercent) || 0;

    const unitMult =
      materialType === 'BLOCO'
        ? (sheetsPerBlock === '' ? 100 : Number(sheetsPerBlock) || 100)
        : materialType === 'PACOTE'
        ? (unitsPerPackage === '' ? 100 : Number(unitsPerPackage) || 100)
        : 1;

    // Dimensões da folha e formato: fallback automático para não travar o cálculo na digitação
    const paperWidth = activePaper ? activePaper.widthMm : 660;
    const paperHeight = activePaper ? activePaper.heightMm : 960;
    const cutWidth = activeFormat ? activeFormat.widthMm : (activePaper ? activePaper.widthMm : 660);
    const cutHeight = activeFormat ? activeFormat.heightMm : (activePaper ? activePaper.heightMm : 960);

    const cutResult = calculateCutYield(paperWidth, paperHeight, cutWidth, cutHeight);

    // Se Quantidade ou Imagens/Chapa estiverem vazios ou <= 0, a matemática mostra 0 até preencher
    if (qty <= 0 || imgs <= 0) {
      return {
        rawUnits: 0,
        rawProductPieces: 0,
        totalFinalSheets: 0,
        yieldPerSheet: cutResult.yield,
        cutsDescription: activeFormat ? cutResult.description : (activePaper ? '1 pose por folha' : '1 pose por folha'),
        fullSheetsNeeded: 0,
        sobraSheets: 0,
        breakCutUnits: 0,
        breakSheetsNeeded: 0,
        totalFactorySheetsUsed: 0,
        totalPrintedSheets: 0,
        packagesCount: 0,
        efficiencyPercent: cutResult.efficiencyPercent,
        surplusPercent: surplus,
        cutResult,
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

    const math = calculateOrderMath({
      blocksQty: qty,
      materialType,
      unitMultiplier: unitMult,
      ways: w,
      wayColors,
      imagesPerPlate: imgs,
      surplusPercent: surplus,
      sheetW: paperWidth,
      sheetH: paperHeight,
      cutW: cutWidth,
      cutH: cutHeight,
    });

    const packageSheets = activePaper?.packageSheets || 250;
    const packagesCount =
      packageSheets > 0
        ? Math.round((math.totalFactorySheetsUsed / packageSheets) * 10) / 10
        : 0;

    return {
      ...math,
      packagesCount,
    };
  }, [
    activePaper,
    activeFormat,
    blocksQty,
    materialType,
    sheetsPerBlock,
    unitsPerPackage,
    ways,
    wayColors,
    imagesPerPlate,
    surplusPercent,
  ]);

  // Validação Impeditiva antes de Salvar ou Imprimir
  const validateForm = (): boolean => {
    const missing: string[] = [];
    if (!bsNumber || !bsNumber.trim()) missing.push('Número do Boletim de Serviço (BS)');
    if (!createdBy || !createdBy.trim()) missing.push('Responsável pelo Preenchimento');
    if (!machine || !machine.trim()) missing.push('Máquina de Impressão');
    if (!productionMonth || !productionMonth.trim()) missing.push('Mês de Produção');
    if (!matchedService) missing.push('Código do Serviço (válido no catálogo)');
    if (!activePaper) missing.push('Papel de Fábrica');
    if (!activeFormat) missing.push('Corte para Impressão');
    if (!blocksQty || Number(blocksQty) <= 0) missing.push('Quantidade (obrigatória e maior que 0)');
    if (!imagesPerPlate || Number(imagesPerPlate) <= 0) missing.push('Imagens por Chapa (obrigatório e mínimo 1)');

    const numWays = Number(ways) || 1;
    if (numWays > 1) {
      for (let i = 1; i < numWays; i++) {
        const colorVal = (wayColors[i] || '').trim();
        if (!colorVal) {
          missing.push(`Cor da Via ${i + 1} (obrigatória quando Vias > 1)`);
          break;
        }
      }
    }

    if (missing.length > 0) {
      setValidationError(
        `Preenchimento obrigatório pendente: ${missing.join(', ')}.`
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    setValidationError(null);
    return true;
  };

  // Iniciar Modo Edição de uma O.S. do Histórico
  const handleStartEdit = (order: ServiceOrder) => {
    setEditingOrderId(order.id);
    setOrderNumber(order.orderNumber);

    const extractedBs =
      order.bsNumber !== undefined && order.bsNumber !== null && String(order.bsNumber).trim() !== ''
        ? String(order.bsNumber)
        : (() => {
            const m =
              (order.orderNumber || '').match(/BS\s*(\d+)/i) ||
              (order.bsCodeKey || '').match(/BS\s*(\d+)/i);
            return m ? m[1] : '';
          })();
    setBsNumber(extractedBs);

    setProductionMonth(
      order.productionMonth ||
      (order.dateEmission ? new Date(order.dateEmission + 'T12:00:00').toLocaleDateString('pt-BR') : getCurrentProductionMonth())
    );
    setCreatedBy(order.createdBy || '');
    setMachine(order.machine || '');
    setObservation(order.observation || '');
    setServiceCodeInput(order.serviceCode || '');
    setSelectedPaperId(order.paperId || '');
    setSelectedFormatId(order.cutFormatId || '');
    setFinalCutSize(order.finalCutSize || '');
    setBlocksQty(order.blocksQty > 0 ? order.blocksQty : '');
    const loadedType: MaterialType = order.materialType || (order.sheetsPerBlock && order.sheetsPerBlock > 1 ? 'BLOCO' : 'BLOCO');
    setMaterialType(loadedType);
    if (loadedType === 'BLOCO') {
      setSheetsPerBlock(order.unitMultiplier || order.sheetsPerBlock || 100);
    } else if (loadedType === 'PACOTE') {
      setUnitsPerPackage(order.unitMultiplier || 100);
    }
    setWays(order.ways || 1);
    // Restaurar cores das vias (se antigo sem cores = tudo branco)
    const initialWayCount = order.ways || 1;
    const loadedColors: string[] = ['Branca'];
    if (order.wayColors && Array.isArray(order.wayColors)) {
      for (let i = 1; i < initialWayCount; i++) {
        loadedColors.push(order.wayColors[i] || 'Branca');
      }
    } else {
      for (let i = 1; i < initialWayCount; i++) {
        loadedColors.push('Branca');
      }
    }
    setWayColors(loadedColors);
    setImagesPerPlate(order.imagesPerPlate || '');
    setSurplusPercent(order.surplusPercent !== undefined ? order.surplusPercent : (order.breakMargin !== undefined ? order.breakMargin : 10));
    setValidationError(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Carrega O.S. enviada da aba Histórico para edição
  React.useEffect(() => {
    if (orderToEdit) {
      handleStartEdit(orderToEdit);
    }
  }, [orderToEdit]);

  // Submit Handler: Unifica Gravação no Firestore e Abertura Automática da Impressão em 1 Único Clique
  const handleSaveAndPrint = async () => {
    if (isSaving) return;

    if (!validateForm()) return;
    if (!matchedService || !activePaper || !activeFormat) return;

    setIsSaving(true);
    try {
      const cleanProductionMonth = productionMonth.trim() || getCurrentProductionMonth();
      const cleanBsNumber = bsNumber.trim();
      // Nomenclatura oficial: "BS [Número] - [CódigoDoMaterial]" (Ex: BS 17 - 654-5125)
      const finalOfficialKey = cleanBsNumber && matchedService
        ? `BS ${cleanBsNumber} - ${matchedService.code}`
        : (cleanBsNumber ? `BS ${cleanBsNumber}` : (editingOrderId ? orderNumber : getNextOrderNumber()));

      const effectiveMultiplier =
        materialType === 'BLOCO'
          ? (sheetsPerBlock === '' ? 100 : Number(sheetsPerBlock) || 100)
          : materialType === 'PACOTE'
          ? (unitsPerPackage === '' ? 100 : Number(unitsPerPackage) || 100)
          : 1;

      const numBlocksQty = Number(blocksQty) || 0;
      const numWays = Math.max(1, Number(ways) || 1);
      const numImages = Math.max(1, Number(imagesPerPlate) || 1);
      const numSurplusPercent = surplusPercent === '' ? 10 : Number(surplusPercent) || 0;

      // Normalização limpa de wayColors para salvar na O.S.
      const normalizedWayColors: string[] = [];
      if (numWays === 1) {
        normalizedWayColors.push('Branca');
      } else {
        for (let i = 0; i < numWays; i++) {
          if (i === 0) {
            normalizedWayColors.push('Branca');
          } else {
            normalizedWayColors.push((wayColors[i] || '').trim() || 'Branca');
          }
        }
      }

      if (editingOrderId) {
        // MODO EDIÇÃO: Atualizar registro existente no Firestore PRIMEIRO
        const updatedFields: Partial<ServiceOrder> = {
          orderNumber: finalOfficialKey,
          bsNumber: cleanBsNumber,
          bsCodeKey: finalOfficialKey,
          productionMonth: cleanProductionMonth,
          dateEmission: cleanProductionMonth,
          createdBy,
          machine,
          observation,
          serviceId: matchedService.id,
          serviceCode: matchedService.code,
          serviceName: matchedService.name,
          serviceCategory: matchedService.category,
          paperId: activePaper.id,
          paperCode: activePaper.code,
          paperName: activePaper.name,
          paperWidthMm: activePaper.widthMm,
          paperHeightMm: activePaper.heightMm,
          packageSheets: activePaper.packageSheets,
          cutFormatId: activeFormat.id,
          cutFormatName: activeFormat.name,
          cutWidthMm: activeFormat.widthMm,
          cutHeightMm: activeFormat.heightMm,
          finalCutSize: finalCutSize.trim() || undefined,
          materialType,
          unitMultiplier: effectiveMultiplier,
          surplusPercent: numSurplusPercent,
          surplusSheets: calculation.sobraSheets,
          totalPrintedSheets: calculation.totalPrintedSheets,
          calcFormulaDescription: calculation.formulaDescription,
          blocksQty: numBlocksQty,
          sheetsPerBlock: effectiveMultiplier,
          ways: numWays,
          wayColors: normalizedWayColors,
          colorBreakdown: calculation.colorBreakdown,
          imagesPerPlate: numImages,
          breakMargin: numSurplusPercent,
        };

        const updatedOrder = await updateOrder(editingOrderId, updatedFields);

        const existing = orders.find((o) => o.id === editingOrderId);
        const mergedOrder: ServiceOrder = updatedOrder || ({
          ...(existing || ({} as ServiceOrder)),
          ...updatedFields,
          id: editingOrderId,
          orderNumber: finalOfficialKey,
          bsNumber: cleanBsNumber,
          bsCodeKey: finalOfficialKey,
          productionMonth: cleanProductionMonth,
          totalFinalSheets: calculation.totalFinalSheets,
          yieldPerSheet: calculation.yieldPerSheet,
          cutsDescription: calculation.cutsDescription,
          fullSheetsNeeded: calculation.fullSheetsNeeded,
          totalFactorySheetsUsed: calculation.totalFactorySheetsUsed,
          packagesCount: calculation.packagesCount,
          efficiencyPercent: calculation.efficiencyPercent,
          materialType,
          unitMultiplier: effectiveMultiplier,
          surplusPercent: numSurplusPercent,
          surplusSheets: calculation.sobraSheets,
          totalPrintedSheets: calculation.totalPrintedSheets,
          calcFormulaDescription: calculation.formulaDescription,
          wayColors: normalizedWayColors,
          colorBreakdown: calculation.colorBreakdown,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now(),
        } as ServiceOrder);

        setSuccessToast(`O.S. ${finalOfficialKey} atualizada no Firebase Firestore com sucesso!`);
        setTimeout(() => setSuccessToast(null), 4000);

        // Disparo imediato da abertura automática do modal de impressão (PrintA4OrderModal)
        onPrintOrder(mergedOrder);

        resetFormToBlank();
      } else {
        // MODO CRIAÇÃO: Gravação no Firebase Firestore PRIMEIRO (e alimenta o Kanban)
        const newOrder = await addOrder({
          orderNumber: finalOfficialKey,
          bsNumber: cleanBsNumber,
          bsCodeKey: finalOfficialKey,
          productionMonth: cleanProductionMonth,
          dateEmission: cleanProductionMonth,
          createdBy,
          machine,
          status: 'Aguardando Início',
          observation,
          serviceId: matchedService.id,
          serviceCode: matchedService.code,
          serviceName: matchedService.name,
          serviceCategory: matchedService.category,
          paperId: activePaper.id,
          paperCode: activePaper.code,
          paperName: activePaper.name,
          paperWidthMm: activePaper.widthMm,
          paperHeightMm: activePaper.heightMm,
          packageSheets: activePaper.packageSheets,
          cutFormatId: activeFormat.id,
          cutFormatName: activeFormat.name,
          cutWidthMm: activeFormat.widthMm,
          cutHeightMm: activeFormat.heightMm,
          finalCutSize: finalCutSize.trim() || undefined,
          materialType,
          unitMultiplier: effectiveMultiplier,
          surplusPercent: numSurplusPercent,
          surplusSheets: calculation.sobraSheets,
          totalPrintedSheets: calculation.totalPrintedSheets,
          calcFormulaDescription: calculation.formulaDescription,
          blocksQty: numBlocksQty,
          sheetsPerBlock: effectiveMultiplier,
          ways: numWays,
          wayColors: normalizedWayColors,
          colorBreakdown: calculation.colorBreakdown,
          imagesPerPlate: numImages,
          breakMargin: numSurplusPercent,
        });

        setSuccessToast(`O.S. ${newOrder.orderNumber} gravada no Firebase Firestore com sucesso!`);
        setTimeout(() => setSuccessToast(null), 4000);

        // Disparo imediato da abertura automática do modal de impressão (PrintA4OrderModal)
        onPrintOrder(newOrder);

        resetFormToBlank();
      }
    } catch (err: any) {
      console.error('[PJERJ DIGRA] Erro ao gravar O.S.:', err);
      setValidationError(`Falha ao gravar no Firestore: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 max-w-[100vw] py-6 space-y-6">
      {/* Toast de Sucesso */}
      {successToast && (
        <div className="bg-emerald-900 border border-emerald-500 text-emerald-100 p-4 rounded-xl shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-sm">{successToast}</span>
          </div>
          <button
            onClick={onNavigateKanban}
            className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5"
          >
            <span>Ver no Kanban</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Alerta de Validação Impeditiva */}
      {validationError && (
        <div className="bg-red-50 border-2 border-red-500 text-red-900 p-4 rounded-xl shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <span className="font-black text-sm block">Validação Impeditiva para Impressão e Salvamento</span>
              <span className="text-xs text-red-800 font-medium">{validationError}</span>
            </div>
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Banner de Modo Edição */}
      {editingOrderId && (
        <div className="bg-amber-50 border-2 border-amber-500 text-amber-950 p-4 rounded-xl shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Edit3 className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-black text-sm block">
                Modo Edição Ativo &bull; O.S. {orderNumber}
              </span>
              <span className="text-xs text-amber-800 font-medium">
                Você está editando uma O.S. existente. Ao salvar ou gerar PDF, os dados serão atualizados no Firebase Firestore.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={resetFormToBlank}
            className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 px-3 py-1.5 rounded-lg font-bold border border-amber-400 transition-colors"
          >
            Cancelar Edição
          </button>
        </div>
      )}

      {/* Institutional Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <PjerjLogo showText={false} className="w-16 h-16" />
          <div>
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              PODER JUDICIÁRIO DO ESTADO DO RIO DE JANEIRO
            </span>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black text-[#2B1D6E] tracking-tight">
                DIGRA - DIVISÃO GRÁFICA
              </h2>
              {isFirebaseActive && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Firestore Conectado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-bold">
              Emissão de Ordem de Serviço &bull; Logística de Produção & Consumo de Papel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetFormToBlank}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors font-medium border border-slate-200 cursor-pointer"
            title="Limpar todos os campos do formulário"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar Formulário</span>
          </button>

          <div className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 text-right min-w-[150px]">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">
              {editingOrderId ? 'Editando O.S.' : 'Boletim / Chave O.S.'}
            </span>
            <span className="text-base font-black font-mono text-[#2B1D6E]">
              {officialBsKey || orderNumber}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Inputs (7 cols) + Realtime Math & Schematic (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            {/* ================= 1. CAMPO OBRIGATÓRIO NO TOPO: BOLETIM DE SERVIÇO (BS) ================= */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border-2 border-indigo-400/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <label htmlFor="bs-number-input" className="block text-sm font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                      <span>Número do Boletim de Serviço (BS):</span>
                      <span className="text-red-400 font-black text-base">*</span>
                    </label>
                    <p className="text-[11px] text-blue-200 font-medium">
                      Identificador obrigatório do lote do mês digitado pelo operador
                    </p>
                  </div>
                </div>

                {/* Exibição em Tempo Real da Chave Oficial: BS [Número] - [CódigoDoMaterial] */}
                <div className="bg-black/50 border border-blue-400/30 px-3.5 py-1.5 rounded-xl text-left sm:text-right shrink-0">
                  <span className="text-[9px] uppercase tracking-wider text-blue-300 font-bold block">
                    Nomenclatura Oficial / Chave O.S.
                  </span>
                  <span className="text-base font-black font-mono text-emerald-300 tracking-tight">
                    {officialBsKey || `BS ${bsNumber || '__'} - ${matchedService?.code || '___-____'}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-7">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-sm font-black text-blue-400 font-mono tracking-wider">BS</span>
                    </div>
                    <input
                      id="bs-number-input"
                      type="number"
                      min="1"
                      value={bsNumber}
                      onChange={(e) => {
                        setBsNumber(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      placeholder="Ex: 17"
                      className={`w-full bg-white text-slate-900 border-2 rounded-xl pl-12 pr-4 py-2.5 text-base sm:text-lg font-black font-mono shadow-inner focus:ring-4 focus:ring-blue-400 focus:outline-none transition-all ${
                        !bsNumber && validationError ? 'border-red-500 ring-2 ring-red-400' : 'border-blue-400'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-blue-200 block mt-1 font-semibold">
                    Digite o número do BS (ex: 17, 28, 742)
                  </span>
                </div>

                <div className="sm:col-span-5 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="top-production-month-input" className="text-xs font-bold text-blue-200 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-300" />
                      <span>Mês de Produção: <span className="text-red-400 font-black">*</span></span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setProductionMonth(getCurrentProductionMonth())}
                      className="text-[10px] text-blue-300 hover:text-white underline cursor-pointer font-semibold"
                      title="Restaurar para o mês corrente automático do sistema"
                    >
                      ↺ Mês Atual
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        id="top-production-month-input"
                        type="text"
                        list="production-months-list"
                        value={productionMonth}
                        onChange={(e) => {
                          setProductionMonth(e.target.value);
                          if (validationError) setValidationError(null);
                        }}
                        placeholder="Ex: Setembro / 2026"
                        className={`w-full bg-white text-slate-900 border-2 rounded-xl pl-3 pr-2 py-2 text-sm font-black font-mono shadow-inner focus:ring-4 focus:ring-blue-400 focus:outline-none transition-all ${
                          !productionMonth && validationError ? 'border-red-500 ring-2 ring-red-400' : 'border-blue-400'
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={openMonthPicker}
                      className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md border border-blue-400/50 cursor-pointer shrink-0 transition-transform active:scale-95"
                      title="Abrir calendário para escolher qualquer mês e ano"
                    >
                      <CalendarDays className="w-4 h-4 text-amber-300" />
                      <span>Calendário</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-blue-200 block mt-1 font-medium">
                    Clique em <strong>Calendário</strong> para escolher qualquer mês e alterar o ano
                  </span>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Bloco 1: Responsável, Máquina & Mês de Produção (3 colunas, sem prioridade) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                <span>Responsável, Máquina & Mês de Produção</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Responsável pelo Preenchimento */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Responsável: <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createdBy}
                    onChange={(e) => {
                      setCreatedBy(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 ${
                      !createdBy && validationError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
                    }`}
                  >
                    <option value="">Selecione o Responsável...</option>
                    {responsibles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Máquina de Impressão */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Máquina: <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={machine}
                    onChange={(e) => {
                      setMachine(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 ${
                      !machine && validationError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
                    }`}
                  >
                    <option value="">Selecione a Máquina...</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* MÊS DE PRODUÇÃO: Autopreenchido de forma inteligente com o mês atual e totalmente editável */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700" title="Período de faturamento e produção oficial">
                      MÊS DE PRODUÇÃO: <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={openMonthPicker}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                      title="Abrir calendário para escolher qualquer mês e ano"
                    >
                      <CalendarDays className="w-3 h-3 text-blue-500" />
                      <span>Calendário</span>
                    </button>
                  </div>
                  <div className="relative flex items-center gap-1.5">
                    <input
                      type="text"
                      list="production-months-list"
                      value={productionMonth}
                      onChange={(e) => {
                        setProductionMonth(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      placeholder="Ex: Outubro / 2026"
                      className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 ${
                        !productionMonth && validationError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={openMonthPicker}
                      className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors cursor-pointer shrink-0"
                      title="Abrir calendário para escolher mês e ano"
                    >
                      <CalendarDays className="w-4 h-4 text-blue-600" />
                    </button>
                    <datalist id="production-months-list">
                      {productionMonthOptions.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Mês corrente ou clique no calendário para outro mês/ano</span>
                  </span>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Bloco 2: Catálogo de Serviços */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                <span>Catálogo de Serviços (Busca com ou sem traço)</span>
              </h3>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Código do Serviço: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={serviceCodeInput}
                      onChange={(e) => {
                        setServiceCodeInput(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      placeholder="Ex: 6545125 ou 654-5125"
                      className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 ${
                        !matchedService && validationError ? 'border-red-500 ring-1 ring-red-500' : 'border-blue-400'
                      }`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ou Selecione pelo Nome Oficial:
                    </label>
                    <select
                      value={matchedService ? matchedService.id : ''}
                      onChange={(e) => {
                        const found = services.find((s) => s.id === e.target.value);
                        if (found) {
                          setServiceCodeInput(found.code);
                          if (validationError) setValidationError(null);
                          const isCapa = Boolean(
                            (found.category && found.category.toUpperCase().includes('CAPA')) ||
                            (found.name && found.name.trim().toLowerCase().startsWith('capa')) ||
                            ((found as any).categoria && String((found as any).categoria).toUpperCase().includes('CAPA')) ||
                            ((found as any).descricao && String((found as any).descricao).trim().toLowerCase().startsWith('capa'))
                          );
                          if (isCapa) {
                            setMaterialType('PACOTE');
                            setUnitsPerPackage(100);
                            const sra3Format = PRINT_CUT_FORMATS.find(
                              (f) => f.name.toUpperCase() === 'SRA3' || f.id === 'fmt-sra3' || (f.widthMm === 328 && f.heightMm === 480)
                            );
                            if (sra3Format) setSelectedFormatId(sra3Format.id);
                            setFinalCutSize('320x460 mm');
                          }
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione na lista do catálogo oficial...</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name} ({s.category})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Card de Identificação Oficial */}
                {matchedService && (
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-200 text-blue-900">
                          {matchedService.code}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900 uppercase">
                          {matchedService.category}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Aprendizado Contínuo Ativo</span>
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900">
                        {matchedService.name}
                      </h4>
                    </div>
                  </div>
                )}

                {/* Banner de Aprendizado Contínuo: Parâmetros Autocompletados com base na última O.S. */}
                {learningInfo && (
                  <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-blue-50 to-emerald-50 border-2 border-indigo-300 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                            Aprendizado Contínuo
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-200 text-indigo-900 border border-indigo-300">
                            Última O.S.: {learningInfo.orderNumber}
                          </span>
                          {learningInfo.productionMonth && (
                            <span className="text-[10px] text-indigo-700 font-semibold">
                              ({learningInfo.productionMonth})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-indigo-900 font-medium mt-1">
                          Parâmetros autocompletados do histórico: <strong>Papel:</strong> {learningInfo.paperName} &bull; <strong>Corte p/ Impressão:</strong> {learningInfo.cutFormatName} &bull; <strong>Corte Final:</strong> {learningInfo.finalCutSize || 'Conforme especificação'}.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          const clean = normalizeCode(serviceCodeInput);
                          const aprendizado = obterParametrosAprendizadoContinuo(clean, orders, papers, PRINT_CUT_FORMATS);
                          if (aprendizado) {
                            setSelectedPaperId(aprendizado.paperId);
                            setSelectedFormatId(aprendizado.cutFormatId);
                            if (aprendizado.finalCutSize) setFinalCutSize(aprendizado.finalCutSize);
                          }
                        }}
                        className="text-[11px] font-bold bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Reaplicar papel e cortes do histórico"
                      >
                        <RotateCcw className="w-3 h-3 text-indigo-600" />
                        <span>Reaplicar Papel/Cortes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLearningInfo(null)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded cursor-pointer"
                        title="Dispensar aviso"
                      >
                        Dispensar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Bloco 3: Engenharia de Papel & Entradas de Produção */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
                <span>Engenharia de Papel & Produção</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Seleção do Papel */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Papel de Fábrica (Formato Bruto): <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedPaperId}
                    onChange={(e) => {
                      setSelectedPaperId(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 ${
                      !activePaper && validationError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
                    }`}
                  >
                    <option value="">Selecione o Papel...</option>
                    {papers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {p.widthMm}x{p.heightMm}mm ({p.packageSheets} fls/pct)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 1. Seleção do Corte para Impressão (Motor do Cálculo Gráfico Obrigatório) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Corte para Impressão: <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedFormatId}
                    onChange={(e) => {
                      setSelectedFormatId(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 ${
                      !activeFormat && validationError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
                    }`}
                  >
                    <option value="">Selecione o Formato de Corte...</option>
                    {PRINT_CUT_FORMATS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.widthMm}x{f.heightMm}mm)
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                    Formato de corte da folha que entra na máquina impressora
                  </span>
                </div>
              </div>

              {/* 2. Campo Corte Final (Produto Acabado / Refile do Trabalho) - Logo abaixo */}
              <div className="mt-3 bg-slate-50/70 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="final-cut-size-input" className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Corte Final (Tamanho do Trabalho):</span>
                  </label>
                  {finalCutSize && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      Refile Acabado: {finalCutSize}
                    </span>
                  )}
                </div>
                <input
                  id="final-cut-size-input"
                  type="text"
                  value={finalCutSize}
                  onChange={(e) => setFinalCutSize(e.target.value)}
                  placeholder="Ex: 105x74 mm"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 placeholder:font-normal placeholder:text-slate-400 shadow-2xs"
                />
                <span className="text-[10px] text-slate-500 block mt-1 font-medium">
                  Especificação livre do refile final após a impressão (Ex: 105x74 mm, 210x148 mm). Autopreenchido pelo histórico do código e 100% editável para alteração.
                </span>
              </div>

              {/* 2) TIPO DE MATERIAL (botões tipo "ticar") */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Tipo de Material: <span className="text-slate-500 font-normal">(define o cálculo das unidades)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {MATERIAL_OPTIONS.map((type) => {
                    const isSelected = materialType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setMaterialType(type);
                          if (type === 'BLOCO' && (!sheetsPerBlock || Number(sheetsPerBlock) <= 0)) {
                            setSheetsPerBlock(100);
                          }
                          if (type === 'PACOTE' && (!unitsPerPackage || Number(unitsPerPackage) <= 0)) {
                            setUnitsPerPackage(100);
                          }
                        }}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                            isSelected ? 'border-white bg-blue-700 text-white' : 'border-slate-400 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                        </div>
                        <span className="tracking-wide">{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantidades de Entrada & Imagens por Chapa */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                {/* Quantidade (obrigatória, fica vazia até preencher) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Quantidade: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={blocksQty}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10));
                      setBlocksQty(isNaN(val as number) ? '' : val);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="Ex: 20"
                    className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 ${
                      validationError && (!blocksQty || Number(blocksQty) <= 0) ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
                    }`}
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                    {materialType === 'BLOCO' ? 'Qtd de Blocos' : materialType === 'PACOTE' ? 'Qtd de Pacotes' : 'Qtd Total'}
                  </span>
                </div>

                {/* Campo Dinâmico: Folhas por Bloco ou Unidades por Pacote */}
                {materialType === 'BLOCO' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Folhas por bloco:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={sheetsPerBlock}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10));
                        setSheetsPerBlock(isNaN(val as number) ? '' : val);
                      }}
                      placeholder="Ex: 100"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">Padrão: 100 folhas</span>
                  </div>
                ) : materialType === 'PACOTE' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Unidades por pacote:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={unitsPerPackage}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10));
                        setUnitsPerPackage(isNaN(val as number) ? '' : val);
                      }}
                      placeholder="Ex: 100"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">Padrão: 100 un (editável)</span>
                  </div>
                ) : (
                  <div className="bg-slate-100/70 border border-dashed border-slate-300 rounded-lg p-2 flex flex-col justify-center items-center text-center">
                    <span className="text-[11px] font-bold text-slate-600 uppercase">{materialType}</span>
                    <span className="text-[10px] text-slate-500 font-medium">Multiplicador: 1x</span>
                  </div>
                )}

                {/* Vias */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Vias:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={ways}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10));
                      const newWays = isNaN(val as number) ? '' : val;
                      setWays(newWays);
                      if (typeof newWays === 'number' && newWays > 1) {
                        setWayColors((prev) => {
                          const next = ['Branca'];
                          for (let i = 1; i < newWays; i++) {
                            next.push(prev[i] || '');
                          }
                          return next;
                        });
                      } else {
                        setWayColors(['Branca']);
                      }
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="1"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Padrão: 1 via</span>
                </div>

                {/* Imagens por Chapa (obrigatória, fica vazia até preencher) */}
                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    Imagens / Chapa: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={imagesPerPlate}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10));
                      setImagesPerPlate(isNaN(val as number) ? '' : val);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="Ex: 2"
                    className={`w-full bg-blue-50 border rounded-lg px-3 py-2 text-sm font-mono font-bold text-blue-950 focus:ring-2 focus:ring-blue-500 ${
                      validationError && (!imagesPerPlate || Number(imagesPerPlate) <= 0) ? 'border-red-500 ring-1 ring-red-500' : 'border-blue-400'
                    }`}
                  />
                  <span className="text-[10px] text-blue-800 block mt-0.5 font-medium">Divisor chapa</span>
                </div>

                {/* 3) RENOMEADO: Sobra (Acerto) em Porcentagem (padrão 10%, editável) */}
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1" title="Porcentagem de sobra para acerto sobre as folhas líquidas">
                    Sobra (Acerto):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={surplusPercent}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10));
                        setSurplusPercent(isNaN(val as number) ? '' : val);
                      }}
                      placeholder="10"
                      className="w-full bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 pr-7 text-sm font-mono font-bold text-amber-950 focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs font-black text-amber-800 pointer-events-none">%</span>
                  </div>
                  <span className="text-[10px] text-amber-800 block mt-0.5 font-semibold">
                    +{calculation.sobraSheets} folhas ({surplusPercent || 0}%)
                  </span>
                </div>
              </div>

              {/* Cores das Vias (quando Vias > 1) */}
              {Number(ways) > 1 && (
                <div className="mt-3.5 bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-sky-950 flex items-center gap-1.5">
                      <span>Cores do Papel por Via ({ways} Vias):</span>
                    </label>
                    <span className="text-[10px] font-semibold text-sky-800">
                      Via 1 fixa Branca &bull; Via 2+ com sugestão ou digitação livre
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {/* Via 1: Fixa Branca */}
                    <div className="bg-white border border-slate-300 rounded-lg p-2.5 shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-black text-slate-800 uppercase">Via 1</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase bg-slate-100 px-1.5 py-0.2 rounded">Fixa</span>
                      </div>
                      <input
                        type="text"
                        disabled
                        value="Branca"
                        className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-not-allowed"
                      />
                    </div>

                    {/* Vias 2 em diante: Campo livre com sugestões e obrigatório */}
                    {Array.from({ length: Number(ways) - 1 }).map((_, idx) => {
                      const wayNumber = idx + 2;
                      const currentColor = wayColors[wayNumber - 1] || '';
                      const isMissing = validationError && !currentColor.trim();

                      return (
                        <div
                          key={wayNumber}
                          className={`bg-white border rounded-lg p-2.5 shadow-2xs ${
                            isMissing ? 'border-red-500 ring-1 ring-red-400 bg-red-50/30' : 'border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-black text-slate-800 uppercase">
                              Via {wayNumber}: <span className="text-red-500">*</span>
                            </span>
                            {currentColor && (
                              <span className="text-[9px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded">
                                {currentColor}
                              </span>
                            )}
                          </div>

                          <input
                            type="text"
                            value={currentColor}
                            list={`color-suggestions-via-${wayNumber}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWayColors((prev) => {
                                const next = [...prev];
                                while (next.length < wayNumber) next.push('');
                                next[wayNumber - 1] = val;
                                return next;
                              });
                              if (validationError) setValidationError(null);
                            }}
                            placeholder="Ex: Azul, Rosa, Verde..."
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 placeholder:font-normal placeholder:text-slate-400"
                          />

                          <datalist id={`color-suggestions-via-${wayNumber}`}>
                            {COMMON_WAY_COLORS.map((c) => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>

                          {/* Chips de clique rápido com sugestões */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {COMMON_WAY_COLORS.slice(0, 5).map((colorName) => (
                              <button
                                key={colorName}
                                type="button"
                                onClick={() => {
                                  setWayColors((prev) => {
                                    const next = [...prev];
                                    while (next.length < wayNumber) next.push('');
                                    next[wayNumber - 1] = colorName;
                                    return next;
                                  });
                                  if (validationError) setValidationError(null);
                                }}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium border cursor-pointer transition-colors ${
                                  currentColor.toLowerCase() === colorName.toLowerCase()
                                    ? 'bg-sky-600 text-white border-sky-700 font-bold'
                                    : 'bg-slate-50 text-slate-700 hover:bg-slate-200 border-slate-200'
                                }`}
                              >
                                {colorName}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observações da Produção */}
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações Técnicas de Produção:
                </label>
                <textarea
                  rows={2}
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder="Ex: Picote serrilhado na margem esquerda, grampo duplo, empacotar de 50 em 50..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Ação Unificada: Gravação no Firestore e Abertura Automática da Impressão em 1 Único Clique */}
            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSaveAndPrint}
                disabled={isSaving}
                className="flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 text-sm cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Salvando no Firestore e Abrindo PDF...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>
                      {editingOrderId ? 'Atualizar e Gerar PDF (A4)' : 'Gerar PDF para Produção (A4)'}
                    </span>
                  </>
                )}
              </button>

              {editingOrderId && (
                <button
                  type="button"
                  onClick={resetFormToBlank}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-colors font-medium border border-slate-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar Edição</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Matemática Gráfica e Miniatura (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-700" />
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider">
                  Matemática Gráfica em Tempo Real
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                Logística de Papel
              </span>
            </div>

            <div className="space-y-3">
              {/* Aviso em Destaque & Frase do Cortador */}
              {calculation.totalFactorySheetsUsed > 0 ? (
                <div className="p-3.5 bg-emerald-50 border-2 border-emerald-400 rounded-xl space-y-2 text-emerald-950 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wide block">
                        Você vai precisar de {calculation.totalPrintedSheets.toLocaleString('pt-BR')} folhas impressas ({calculation.totalFinalSheets.toLocaleString('pt-BR')} líq. + {calculation.sobraSheets} sobra)
                      </span>
                    </div>
                  </div>
                  <div className="p-2 bg-white/95 border border-emerald-300 rounded-lg font-mono text-xs text-emerald-900 font-bold leading-relaxed space-y-1">
                    {calculation.colorBreakdown.length > 1 ? (
                      calculation.colorBreakdown.map((item, idx) => (
                        <div key={idx}>
                          ✂️ <strong>CORTADOR:</strong> CORTAR EXATAMENTE <strong>{item.totalColorSheets.toLocaleString('pt-BR')}</strong> FOLHAS INTEIRAS {activePaper?.name ? activePaper.name.toUpperCase() : 'PAPEL'} COR {item.color.toUpperCase()} NO FORMATO DE CORTE PARA IMPRESSÃO {activeFormat?.name || 'CORTE'} (FORMATO {calculation.yieldPerSheet})
                        </div>
                      ))
                    ) : (
                      <div>
                        ✂️ <strong>CORTADOR:</strong> CORTAR EXATAMENTE <strong>{calculation.totalFactorySheetsUsed.toLocaleString('pt-BR')}</strong> FOLHAS INTEIRAS {activePaper?.name ? activePaper.name.toUpperCase() : 'PAPEL'} NO FORMATO DE CORTE PARA IMPRESSÃO {activeFormat?.name || 'CORTE'} (FORMATO {calculation.yieldPerSheet})
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-center text-xs text-amber-900 font-medium">
                  Preencha a <strong>Quantidade</strong> e <strong>Imagens / Chapa</strong> para visualizar os cálculos em tempo real.
                </div>
              )}

              {/* Memória de Cálculo Resumida */}
              {calculation.formulaDescription && (
                <div className="p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-[11px] text-slate-800 font-bold leading-relaxed shadow-2xs">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans font-black mb-0.5">
                    Memória de Cálculo:
                  </span>
                  {calculation.formulaDescription}
                </div>
              )}

              {/* 1. Total Folhas Finais Impressas */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-700 block font-bold">
                    1. Total Folhas Finais Impressas
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {calculation.rawUnits > 0
                      ? `(${calculation.rawUnits.toLocaleString('pt-BR')} un${Number(ways) > 1 ? ` × ${ways} vias` : ''}) ÷ ${imagesPerPlate || 1} img/chapa`
                      : '0 folhas impressas'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono text-blue-900">
                    {calculation.totalFinalSheets.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-medium">folhas impressas</span>
                </div>
              </div>

              {/* 2. Aproveitamento */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-700 block font-bold">
                    2. Aproveitamento
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {calculation.cutsDescription}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono text-indigo-900">
                    {calculation.yieldPerSheet}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-medium">
                    {calculation.yieldPerSheet === 1 ? 'pose por folha' : 'poses por folha'}
                  </span>
                </div>
              </div>

              {/* 3. Folhas Líquidas */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-700 block font-bold">
                    3. Folhas Líquidas
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Math.ceil({calculation.totalFinalSheets} ÷ {calculation.yieldPerSheet})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono text-slate-800">
                    {calculation.fullSheetsNeeded.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-medium">folhas líquidas</span>
                </div>
              </div>

              {/* + Sobra (Acerto) */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-700 block font-bold">
                    + Sobra (Acerto) {surplusPercent || 0}% = +{calculation.breakSheetsNeeded} folhas
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium">
                    Math.ceil({calculation.fullSheetsNeeded} × {surplusPercent || 0}% ÷ 100)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black font-mono text-amber-600">
                    +{calculation.breakSheetsNeeded}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-medium">folhas de sobra</span>
                </div>
              </div>

              {/* Papel por Cor */}
              {calculation.colorBreakdown && calculation.colorBreakdown.length > 0 && calculation.totalFactorySheetsUsed > 0 && (
                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between border-b border-sky-200/80 pb-1.5">
                    <span className="text-xs font-black uppercase text-sky-950 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-600 inline-block"></span>
                      Papel por Cor ({calculation.colorBreakdown.length} {calculation.colorBreakdown.length === 1 ? 'cor' : 'cores'}):
                    </span>
                    <span className="text-[10px] font-bold text-sky-800">
                      Gasto Total: {calculation.totalFactorySheetsUsed.toLocaleString('pt-BR')} fls
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-0.5">
                    {calculation.colorBreakdown.map((item) => (
                      <div
                        key={item.color}
                        className="flex items-center justify-between bg-white border border-sky-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.color}:</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {item.waysCount} {item.waysCount === 1 ? 'via' : 'vias'} &bull; {item.printedSheets} imp. &bull; {item.liquidSheets} líq. + {item.surplusSheets} sobra
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-sky-950">
                            {item.totalColorSheets.toLocaleString('pt-BR')} folhas
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Frase explicativa guilhotineiro rápida */}
                  <div className="text-[10px] text-sky-900 bg-sky-100/70 rounded p-1.5 font-medium leading-relaxed mt-1">
                    {calculation.colorBreakdown.map((item, idx) => (
                      <div key={idx} className="truncate">
                        &bull; <strong>{item.color}:</strong> {item.totalColorSheets.toLocaleString('pt-BR')} folhas inteiras ({activePaper?.name || 'papel'})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Gasto Total */}
              <div className="p-4 rounded-xl bg-blue-50 text-blue-900 border-2 border-blue-300 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-black tracking-wider text-blue-900 block">
                    Gasto Total
                  </span>
                  <span className="text-[11px] text-blue-800 font-semibold">
                    {calculation.fullSheetsNeeded} líquidas + {calculation.breakSheetsNeeded} sobra
                  </span>
                  {activePaper && (
                    <span className="inline-block mt-1 text-[10px] font-bold text-blue-950 bg-blue-200/70 border border-blue-300 px-2 py-0.5 rounded">
                      ~ {calculation.packagesCount} pacotes ({activePaper.packageSheets} fls/pct)
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black font-mono text-blue-950 tracking-tight">
                    {calculation.totalFactorySheetsUsed.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-[11px] uppercase font-bold text-blue-800 block">
                    Folhas de Papel
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Miniatura Gráfica da Folha */}
          {activePaper && activeFormat && (
            <CuttingSchematic
              sheetW={activePaper.widthMm}
              sheetH={activePaper.heightMm}
              cutW={activeFormat.widthMm}
              cutH={activeFormat.heightMm}
              cutResult={calculation.cutResult}
              paperName={activePaper.name}
              cutFormatName={activeFormat.name}
            />
          )}
        </div>
      </div>

      {/* ================= MODAL SELETOR DE MÊS E ANO DE PRODUÇÃO ================= */}
      {isMonthPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            {/* Header do Seletor */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide uppercase">
                    Mês e Ano de Produção
                  </h3>
                  <p className="text-[11px] text-blue-200 font-medium">
                    Escolha o mês e altere o ano conforme a demanda
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(false)}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Barra do Ano com Setas e Input Direto */}
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPickerYear((prev) => prev - 1)}
                  className="p-2 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="Ano Anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold text-slate-500">Ano:</span>
                  <input
                    type="number"
                    value={pickerYear}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) setPickerYear(val);
                    }}
                    className="w-24 text-center font-black font-mono text-xl text-blue-900 bg-white border-2 border-blue-300 rounded-xl py-1 px-2 shadow-inner focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setPickerYear((prev) => prev + 1)}
                  className="p-2 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="Próximo Ano"
                >
                  <span className="hidden sm:inline">Próximo</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Botões de Atalho de Anos e Mês Vigente */}
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setPickerYear(y)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        pickerYear === y
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const current = getCurrentProductionMonth();
                    setProductionMonth(current);
                    setIsMonthPickerOpen(false);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition-colors cursor-pointer"
                  title="Usar mês e ano corrente de hoje"
                >
                  ↺ Mês Vigente ({getCurrentProductionMonth()})
                </button>
              </div>

              {/* Grade com os 12 Meses */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Selecione o Mês Desejado:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MONTHS_PT.map((m, idx) => {
                    const isSelected = productionMonth === `${m} / ${pickerYear}`;
                    const isCurrentMonthNow =
                      m === MONTHS_PT[new Date().getMonth()] &&
                      pickerYear === new Date().getFullYear();

                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSelectMonth(m, pickerYear)}
                        className={`p-2.5 rounded-xl text-center text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300 scale-102'
                            : isCurrentMonthNow
                            ? 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-slate-50 hover:bg-blue-50 text-slate-800 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <span className={`text-[10px] font-mono ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="leading-tight">{m}</span>
                        {isCurrentMonthNow && (
                          <span className={`text-[9px] font-bold ${isSelected ? 'text-amber-300' : 'text-emerald-700'}`}>
                            (Hoje)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rodapé Informativo */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Mês Atual da O.S.:
                  </span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {productionMonth || 'Não definido'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMonthPickerOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderEmissionView;
