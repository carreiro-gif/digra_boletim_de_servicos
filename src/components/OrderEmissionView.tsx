import React, { useState, useMemo } from 'react';
import { useGraphic } from '../context/GraphicContext';
import {
  calculateCutYield,
  calculateOrderMath,
  getCurrentProductionMonth,
  getProductionMonthOptions,
} from '../utils/graphicMath';
import { CuttingSchematic } from './CuttingSchematic';
import { PjerjLogo } from './PjerjLogo';
import { ServiceOrder } from '../types';
import {
  obterParametrosAprendizadoContinuo,
  buscarUltimaOSPorCodigo,
} from '../utils/importadorSismat';
import {
  FileText,
  Printer,
  Save,
  CheckCircle2,
  Calculator,
  Search,
  ChevronRight,
  RotateCcw,
  Edit3,
  Trash2,
  AlertTriangle,
  X,
  Calendar,
  Sparkles,
  History,
} from 'lucide-react';

interface OrderEmissionViewProps {
  onPrintOrder: (order: ServiceOrder) => void;
  onNavigateKanban: () => void;
}

export const OrderEmissionView: React.FC<OrderEmissionViewProps> = ({
  onPrintOrder,
  onNavigateKanban,
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

  // Form State: Mês de produção autopreenchido de forma inteligente (ex: "Outubro / 2026")
  const [bsNumber, setBsNumber] = useState<string>(''); // Campo visual e obrigatório do Boletim de Serviço (BS)
  const [orderNumber, setOrderNumber] = useState<string>(() => getNextOrderNumber());
  const [productionMonth, setProductionMonth] = useState<string>(() => getCurrentProductionMonth());
  const [createdBy, setCreatedBy] = useState<string>('');
  const [machine, setMachine] = useState<string>('');
  const [observation, setObservation] = useState<string>('');

  // Busca Inteligente de Código (Ignorando traços / hífens)
  const [serviceCodeInput, setServiceCodeInput] = useState<string>('');

  // Papel e Formato (Em branco / não selecionado inicialmente)
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');

  // Entradas de Produção
  const [blocksQty, setBlocksQty] = useState<number>(0);
  const [sheetsPerBlock, setSheetsPerBlock] = useState<number>(0);
  const [ways, setWays] = useState<number>(0);
  const [imagesPerPlate, setImagesPerPlate] = useState<number>(1);
  const [breakMargin, setBreakMargin] = useState<number>(0); // Quantidade de unidades de corte extras

  // Lógica de Aprendizado Contínuo
  const [learningInfo, setLearningInfo] = useState<{
    orderNumber: string;
    productionMonth: string;
    paperName: string;
    cutFormatName: string;
    blocksQty: number;
    breakMargin: number;
    machine: string;
  } | null>(null);
  const lastAppliedCodeRef = React.useRef<string>('');

  // Mensagens e Toasts
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

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

  // LÓGICA DE APRENDIZADO CONTÍNUO ATIVA:
  // Ao digitar qualquer código no formulário, o sistema busca a O.S. mais recente desse código
  // e autocompleta o Papel, Formato de Corte, Quantidade e Sobra com base na última alteração feita.
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

    const aprendizado = obterParametrosAprendizadoContinuo(clean, orders, papers, formats);
    if (aprendizado && aprendizado.found && aprendizado.order) {
      lastAppliedCodeRef.current = clean;
      if (aprendizado.paperId) setSelectedPaperId(aprendizado.paperId);
      if (aprendizado.cutFormatId) setSelectedFormatId(aprendizado.cutFormatId);
      if (aprendizado.blocksQty !== undefined) setBlocksQty(aprendizado.blocksQty);
      if (aprendizado.sheetsPerBlock !== undefined) setSheetsPerBlock(aprendizado.sheetsPerBlock);
      if (aprendizado.ways !== undefined) setWays(aprendizado.ways);
      if (aprendizado.imagesPerPlate !== undefined) setImagesPerPlate(aprendizado.imagesPerPlate);
      if (aprendizado.breakMargin !== undefined) setBreakMargin(aprendizado.breakMargin); // Sobra
      if (aprendizado.machine && !machine) setMachine(aprendizado.machine);

      setLearningInfo({
        orderNumber: aprendizado.order.orderNumber,
        productionMonth: aprendizado.order.productionMonth || '',
        paperName: aprendizado.order.paperName,
        cutFormatName: aprendizado.order.cutFormatName,
        blocksQty: aprendizado.blocksQty,
        breakMargin: aprendizado.breakMargin,
        machine: aprendizado.machine,
      });
    } else {
      setLearningInfo(null);
    }
  }, [serviceCodeInput, orders, papers, formats, editingOrderId, machine]);

  // Reset total do formulário para nova O.S. (com Mês de Produção inteligente do sistema)
  const resetFormToBlank = () => {
    setEditingOrderId(null);
    setBsNumber('');
    setProductionMonth(getCurrentProductionMonth());
    setCreatedBy('');
    setMachine('');
    setObservation('');
    setServiceCodeInput('');
    setSelectedPaperId('');
    setSelectedFormatId('');
    setBlocksQty(0);
    setSheetsPerBlock(0);
    setWays(0);
    setImagesPerPlate(1);
    setBreakMargin(0);
    setValidationError(null);
    setLearningInfo(null);
    lastAppliedCodeRef.current = '';
    setOrderNumber(getNextOrderNumber());
  };

  // Papel e Formato selecionados
  const activePaper = useMemo(() => {
    return papers.find((p) => p.id === selectedPaperId) || null;
  }, [papers, selectedPaperId]);

  const activeFormat = useMemo(() => {
    return formats.find((f) => f.id === selectedFormatId) || null;
  }, [formats, selectedFormatId]);

  // Cálculo Gráfico em Tempo Real com Quebra em Unidades de Corte:
  // 1. Folhas Líquidas = Math.ceil(Total de Folhas Impressas / Aproveitamento)
  // 2. Folhas de Quebra = Math.ceil(Quebra em Unidades Extras / Aproveitamento)
  // 3. Gasto Total de Papel (Fls) = Folhas Líquidas + Folhas de Quebra
  const calculation = useMemo(() => {
    if (!activePaper || !activeFormat) {
      return {
        rawProductPieces: 0,
        totalFinalSheets: 0,
        yieldPerSheet: 1,
        cutsDescription: 'Selecione o papel e formato de corte',
        fullSheetsNeeded: 0,
        breakCutUnits: breakMargin,
        breakSheetsNeeded: 0,
        totalFactorySheetsUsed: 0,
        packagesCount: 0,
        efficiencyPercent: 0,
        cutResult: calculateCutYield(660, 960, 210, 297),
      };
    }

    const math = calculateOrderMath({
      blocksQty,
      sheetsPerBlock,
      ways,
      imagesPerPlate: Math.max(1, imagesPerPlate || 1),
      breakMargin,
      sheetW: activePaper.widthMm,
      sheetH: activePaper.heightMm,
      cutW: activeFormat.widthMm,
      cutH: activeFormat.heightMm,
    });

    const packageSheets = activePaper.packageSheets || 250;
    const packagesCount =
      packageSheets > 0
        ? Math.round((math.totalFactorySheetsUsed / packageSheets) * 10) / 10
        : 0;

    return {
      ...math,
      packagesCount,
    };
  }, [activePaper, activeFormat, blocksQty, sheetsPerBlock, ways, imagesPerPlate, breakMargin]);

  // Validação Impeditiva antes de Salvar ou Imprimir
  const validateForm = (): boolean => {
    const missing: string[] = [];
    if (!bsNumber || !bsNumber.trim()) missing.push('Número do Boletim de Serviço (BS)');
    if (!createdBy || !createdBy.trim()) missing.push('Responsável pelo Preenchimento');
    if (!machine || !machine.trim()) missing.push('Máquina de Impressão');
    if (!productionMonth || !productionMonth.trim()) missing.push('Mês de Produção');
    if (!matchedService) missing.push('Código do Serviço (válido no catálogo)');
    if (!activePaper) missing.push('Papel de Fábrica');
    if (!activeFormat) missing.push('Formato de Corte ABNT');

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
    setBlocksQty(order.blocksQty || 0);
    setSheetsPerBlock(order.sheetsPerBlock || 0);
    setWays(order.ways || 0);
    setImagesPerPlate(order.imagesPerPlate || 1);
    setBreakMargin(order.breakMargin || 0);
    setValidationError(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Exclusão Permanente de O.S. no Firebase Firestore
  const handleDeleteOrder = (order: ServiceOrder) => {
    const confirmed = window.confirm(
      `Deseja realmente excluir permanentemente a O.S. ${order.orderNumber}?\n\nEsta ação removerá o registro do banco de dados Firebase Firestore e não poderá ser desfeita.`
    );
    if (!confirmed) return;

    deleteOrder(order.id);

    if (editingOrderId === order.id) {
      resetFormToBlank();
    }

    setSuccessToast(`O.S. ${order.orderNumber} excluída permanentemente com sucesso.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Submit Handler: Unifica Salvamento no Firestore e Abertura da Impressão
  const handleSubmit = (shouldPrintAfterSave: boolean = false) => {
    if (!validateForm()) return;
    if (!matchedService || !activePaper || !activeFormat) return;

    const cleanProductionMonth = productionMonth.trim() || getCurrentProductionMonth();
    const cleanBsNumber = bsNumber.trim();
    // Associação de Nomenclatura e Data: "BS [Número] - [CódigoDoMaterial]" (Exemplo: BS 17 - 654-5125)
    const finalOfficialKey = cleanBsNumber && matchedService
      ? `BS ${cleanBsNumber} - ${matchedService.code}`
      : (cleanBsNumber ? `BS ${cleanBsNumber}` : (editingOrderId ? orderNumber : getNextOrderNumber()));

    if (editingOrderId) {
      // MODO EDIÇÃO: Atualizar registro existente no Firestore
      const updatedFields: Partial<ServiceOrder> = {
        orderNumber: finalOfficialKey,
        bsNumber: cleanBsNumber,
        bsCodeKey: finalOfficialKey,
        productionMonth: cleanProductionMonth,
        dateEmission: cleanProductionMonth, // compatibilidade
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
        blocksQty: Math.max(0, blocksQty),
        sheetsPerBlock: Math.max(0, sheetsPerBlock),
        ways: Math.max(0, ways),
        imagesPerPlate: Math.max(1, imagesPerPlate),
        breakMargin: Math.max(0, breakMargin),
      };

      updateOrder(editingOrderId, updatedFields);

      const existing = orders.find((o) => o.id === editingOrderId);
      const mergedOrder: ServiceOrder = {
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
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      } as ServiceOrder;

      setSuccessToast(`O.S. ${finalOfficialKey} atualizada no Firebase Firestore com sucesso!`);
      setTimeout(() => setSuccessToast(null), 4000);

      if (shouldPrintAfterSave) {
        onPrintOrder(mergedOrder);
      }

      resetFormToBlank();
    } else {
      // MODO CRIAÇÃO: Gerar registro oficial "BS [Número] - [CódigoDoMaterial]" e salvar no Firestore
      const newOrder = addOrder({
        orderNumber: finalOfficialKey,
        bsNumber: cleanBsNumber,
        bsCodeKey: finalOfficialKey,
        productionMonth: cleanProductionMonth,
        dateEmission: cleanProductionMonth, // compatibilidade
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
        blocksQty: Math.max(0, blocksQty),
        sheetsPerBlock: Math.max(0, sheetsPerBlock),
        ways: Math.max(0, ways),
        imagesPerPlate: Math.max(1, imagesPerPlate),
        breakMargin: Math.max(0, breakMargin),
      });

      setSuccessToast(`O.S. ${newOrder.orderNumber} salva no Firebase Firestore com sucesso!`);
      setTimeout(() => setSuccessToast(null), 4000);

      if (shouldPrintAfterSave) {
        onPrintOrder(newOrder);
      }

      resetFormToBlank();
    }
  };

  // Recent Orders Filter
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.serviceName.toLowerCase().includes(q) ||
          o.paperName.toLowerCase().includes(q) ||
          o.createdBy.toLowerCase().includes(q) ||
          o.machine.toLowerCase().includes(q) ||
          (o.productionMonth && o.productionMonth.toLowerCase().includes(q))
        );
      })
      .slice(0, 10);
  }, [orders, searchTerm]);

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
                  <div className="relative">
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
                      className={`w-full bg-white text-slate-900 border-2 rounded-xl px-3 py-2 text-sm font-black font-mono shadow-inner focus:ring-4 focus:ring-blue-400 focus:outline-none transition-all ${
                        !productionMonth && validationError ? 'border-red-500 ring-2 ring-red-400' : 'border-blue-400'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-blue-200 block mt-1 font-medium">
                    100% editável para qualquer mês/ano (retroativo ou futuro)
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
                  <label className="block text-xs font-bold text-slate-700 mb-1" title="Período de faturamento e produção oficial">
                    MÊS DE PRODUÇÃO: <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
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
                    <datalist id="production-months-list">
                      {productionMonthOptions.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Mês corrente do sistema &bull; Editável</span>
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
                          Parâmetros autocompletados da última alteração: <strong>Papel:</strong> {learningInfo.paperName} &bull; <strong>Formato:</strong> {learningInfo.cutFormatName} &bull; <strong>Quantidade:</strong> {learningInfo.blocksQty} &bull; <strong>Sobra:</strong> {learningInfo.breakMargin} un.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          const clean = normalizeCode(serviceCodeInput);
                          const aprendizado = obterParametrosAprendizadoContinuo(clean, orders, papers, formats);
                          if (aprendizado && aprendizado.order) {
                            setSelectedPaperId(aprendizado.paperId);
                            setSelectedFormatId(aprendizado.cutFormatId);
                            setBlocksQty(aprendizado.blocksQty);
                            setSheetsPerBlock(aprendizado.sheetsPerBlock);
                            setWays(aprendizado.ways);
                            setImagesPerPlate(aprendizado.imagesPerPlate);
                            setBreakMargin(aprendizado.breakMargin);
                          }
                        }}
                        className="text-[11px] font-bold bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Reaplicar valores da última O.S."
                      >
                        <RotateCcw className="w-3 h-3 text-indigo-600" />
                        <span>Reaplicar</span>
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

                {/* Seleção do Formato de Corte ABNT */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Formato de Corte Final (ABNT): <span className="text-red-500">*</span>
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
                    {formats.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.widthMm}x{f.heightMm}mm)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantidades de Entrada & Imagens por Chapa */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1" title="Para capas, fichas ou avulsos, digite a quantidade total aqui">
                    Quantidade: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={blocksQty || ''}
                    onChange={(e) => setBlocksQty(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Ex: 200"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">Total p/ avulsos</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Folhas / Bloco:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={sheetsPerBlock || ''}
                    onChange={(e) => setSheetsPerBlock(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="1 (avulso)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">1 = avulso</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vias:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={ways || ''}
                    onChange={(e) => setWays(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="1"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Padrão: 1</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    Imagens / Chapa: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={imagesPerPlate}
                    onChange={(e) => setImagesPerPlate(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-blue-50 border border-blue-400 rounded-lg px-3 py-2 text-sm font-mono font-bold text-blue-950 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-blue-800 block mt-0.5">Divisor chapa</span>
                </div>

                {/* Quebra em Unidades de Corte Extras */}
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1" title="Quantidade de unidades de corte extras desejadas para acerto">
                    Quebra (Peças Extras):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={breakMargin || ''}
                    onChange={(e) => setBreakMargin(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-950 focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-amber-800 block mt-0.5">
                    +{calculation.breakSheetsNeeded} fls brutas
                  </span>
                </div>
              </div>

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

            {/* Ações: Salvar e Gerar PDF com Validação e Persistência Automática */}
            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {editingOrderId ? 'Atualizar O.S. no Firestore' : 'Salvar Registro de O.S.'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {editingOrderId ? 'Atualizar e Gerar PDF (A4)' : 'Gerar PDF para Produção (A4)'}
                </span>
              </button>

              {editingOrderId && (
                <button
                  type="button"
                  onClick={resetFormToBlank}
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
              {/* 1. Total Folhas Finais Impressas */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-700 block font-bold">
                    1. Total Folhas Finais Impressas
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ({blocksQty || 0} × {sheetsPerBlock || 1} × {ways || 1}) ÷ {imagesPerPlate || 1} img/chapa
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono text-blue-900">
                    {calculation.totalFinalSheets.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-medium">folhas impressas</span>
                </div>
              </div>

              {/* 2. Aproveitamento do Papel */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-700 block font-bold">
                    2. Aproveitamento do Papel
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {calculation.cutsDescription}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono text-indigo-900">
                    {calculation.yieldPerSheet}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-medium">poses por folha</span>
                </div>
              </div>

              {/* 3. Folhas Líquidas Necessárias */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-700 block font-bold">
                    3. Folhas Líquidas Necessárias
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

              {/* Margem de Quebra em Peças e Folhas */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-700 block font-bold">
                    + Quebra de Acerto da Máquina
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium">
                    {breakMargin} peças extras ÷ {calculation.yieldPerSheet} poses
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black font-mono text-amber-600">
                    +{calculation.breakSheetsNeeded}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-medium">folhas brutas</span>
                </div>
              </div>

              {/* 4. GASTO TOTAL DE PAPEL (FLS) */}
              <div className="p-4 rounded-xl bg-blue-50 text-blue-900 border-2 border-blue-300 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-black tracking-wider text-blue-900 block">
                    Gasto Total de Papel (Fls)
                  </span>
                  <span className="text-[11px] text-blue-800 font-semibold">
                    {calculation.fullSheetsNeeded} líquidas + {calculation.breakSheetsNeeded} quebra
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

      {/* Histórico Recente de Ordens de Serviço com Coluna PRODUÇÃO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Histórico Recente de Ordens de Serviço</span>
            </h3>
            <p className="text-xs text-slate-500">
              Gerenciamento completo (Edição, Exclusão no Firestore e Reimpressão de Folha A4)
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por O.S., serviço, papel, mês..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Nº O.S.</th>
                <th className="py-2.5 px-3">Produção</th>
                <th className="py-2.5 px-3">Responsável</th>
                <th className="py-2.5 px-3">Máquina</th>
                <th className="py-2.5 px-3">Serviço</th>
                <th className="py-2.5 px-3">Papel & Formato</th>
                <th className="py-2.5 px-3 text-center">Img/Chapa</th>
                <th className="py-2.5 px-3 text-center">Gasto Total (Fls)</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-500">
                    Nenhuma Ordem de Serviço encontrada.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      editingOrderId === order.id ? 'bg-amber-50/80 border-l-4 border-amber-500' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                      {order.orderNumber}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {order.productionMonth || (order.dateEmission ? new Date(order.dateEmission + 'T12:00:00').toLocaleDateString('pt-BR') : '-')}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {order.createdBy}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {order.machine}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      <div className="line-clamp-1">{order.serviceName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{order.serviceCode}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="line-clamp-1">{order.paperName}</div>
                      <div className="text-[10px] text-slate-400">
                        {order.cutFormatName} ({order.yieldPerSheet} poses)
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-600">
                      {order.imagesPerPlate || 1}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/50">
                      {order.totalFactorySheetsUsed.toLocaleString('pt-BR')} fls
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                        {order.status}
                      </span>
                    </td>
                    {/* Coluna Ações com CRUD: Editar, Excluir e Imprimir PDF */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-center">
                        {/* 1. Editar O.S. */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(order)}
                          className="p-1.5 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                          title="Editar esta O.S. no formulário"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* 2. Excluir O.S. */}
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order)}
                          className="p-1.5 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                          title="Excluir O.S. permanentemente do Firestore"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* 3. Imprimir / Gerar PDF A4 */}
                        <button
                          type="button"
                          onClick={() => onPrintOrder(order)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-all border border-blue-200 cursor-pointer"
                          title="Reimprimir Boletim de Trabalho A4"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrderEmissionView;
