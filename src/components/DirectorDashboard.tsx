import React, { useState, useMemo, useEffect } from 'react';
import { useGraphic } from '../context/GraphicContext';
import { db, isFirebaseConfigured } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { ServiceOrder } from '../types';
import {
  LayoutDashboard,
  Calendar,
  Layers,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  Package,
  FileText,
  BarChart3,
  Radio,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

/**
 * Normaliza a string de mês de produção para comparação segura e insensível a maiúsculas/espaços.
 * Exemplo: "Outubro / 2026", "outubro / 2026", "Outubro/2026" -> "outubro / 2026"
 */
export const normalizeProductionMonth = (val?: string | null): string => {
  if (!val) return '';
  return val
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ');
};

/**
 * Formata o mês de produção para exibição padronizada (Ex: "Outubro / 2026")
 */
export const canonicalizeMonthDisplay = (val?: string | null): string => {
  if (!val) return '';
  const trimmed = val.trim();
  const parts = trimmed.split(/[\s/]+/);
  if (parts.length >= 2) {
    const month = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const year = parts[parts.length - 1];
    return `${month} / ${year}`;
  }
  return trimmed;
};

export const DirectorDashboard: React.FC = () => {
  const { orders: contextOrders } = useGraphic();

  // 1. FONTE DE DADOS PRINCIPAL E REATIVIDADE EM TEMPO REAL:
  // Escuta diretamente a coleção 'orders' do Firestore via onSnapshot
  const [firestoreOrders, setFirestoreOrders] = useState<ServiceOrder[]>([]);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setFirestoreOrders(contextOrders);
      return;
    }

    try {
      // Listener direto na coleção principal de ordens ('orders')
      const unsub = onSnapshot(
        collection(db, 'orders'),
        (snapshot) => {
          const remoteList: ServiceOrder[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
            } as ServiceOrder;
          });
          setFirestoreOrders(remoteList);
          setIsLiveConnected(true);
          setLastSyncTime(new Date());
        },
        (error) => {
          console.warn('[DirectorDashboard] Erro no listener direto de orders, usando cache local:', error);
          setFirestoreOrders(contextOrders);
        }
      );

      return () => unsub();
    } catch (err) {
      console.warn('[DirectorDashboard] Falha ao registrar onSnapshot:', err);
      setFirestoreOrders(contextOrders);
    }
  }, [contextOrders]);

  // Lista mestre de ordens (prioridade para a escuta direta do Firestore)
  const allOrders = useMemo(() => {
    if (firestoreOrders.length > 0) return firestoreOrders;
    return contextOrders;
  }, [firestoreOrders, contextOrders]);

  // 2. ALINHAMENTO DE CAMPOS (Mês de Produção):
  // Extrai todos os meses de produção distintos cadastrados nas O.S.
  const availableMonths = useMemo(() => {
    const map = new Map<string, string>(); // normalized -> canonical display

    allOrders.forEach((o) => {
      const rawMonth = (o.productionMonth || o.dateEmission || '').trim();
      if (rawMonth) {
        const norm = normalizeProductionMonth(rawMonth);
        if (!map.has(norm)) {
          map.set(norm, canonicalizeMonthDisplay(rawMonth));
        }
      }
    });

    // Garante que o mês corrente "Outubro / 2026" esteja na lista para acesso rápido
    const currentNorm = normalizeProductionMonth('Outubro / 2026');
    if (!map.has(currentNorm)) {
      map.set(currentNorm, 'Outubro / 2026');
    }

    return Array.from(map.entries())
      .map(([norm, display]) => ({ norm, display }))
      .sort((a, b) => b.display.localeCompare(a.display));
  }, [allOrders]);

  // Estado do Filtro: 'TODOS' por padrão para que nenhuma O.S. de teste seja descartada
  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');

  // Filtragem estrita e segura por Mês de Produção
  const filteredOrders = useMemo(() => {
    if (selectedMonth === 'TODOS') {
      return allOrders;
    }

    const selectedNorm = normalizeProductionMonth(selectedMonth);

    return allOrders.filter((o) => {
      const orderMonthNorm = normalizeProductionMonth(o.productionMonth || o.dateEmission);
      return orderMonthNorm === selectedNorm;
    });
  }, [allOrders, selectedMonth]);

  // Agrupamento Consolidado por Tipo de Papel (Soma de Folhas Líquidas, Sobra e Gasto Total)
  const paperConsumptionGroup = useMemo(() => {
    const groupMap: Record<
      string,
      {
        paperId: string;
        paperName: string;
        paperCode: string;
        packageSheets: number;
        widthMm: number;
        heightMm: number;
        ordersCount: number;
        totalFinalSheets: number;
        fullSheetsNeeded: number;
        breakMarginTotal: number;
        totalFactorySheetsUsed: number;
        ordersList: string[];
      }
    > = {};

    filteredOrders.forEach((o) => {
      const key = (o.paperName || o.paperCode || 'Papel Não Especificado').trim();
      if (!groupMap[key]) {
        groupMap[key] = {
          paperId: o.paperId || '',
          paperName: o.paperName || key,
          paperCode: o.paperCode || '',
          packageSheets: Number(o.packageSheets) || 250,
          widthMm: Number(o.paperWidthMm) || 0,
          heightMm: Number(o.paperHeightMm) || 0,
          ordersCount: 0,
          totalFinalSheets: 0,
          fullSheetsNeeded: 0,
          breakMarginTotal: 0,
          totalFactorySheetsUsed: 0,
          ordersList: [],
        };
      }

      const liquid = Number(o.fullSheetsNeeded) || 0;
      const surplus = Number(o.surplusSheets !== undefined ? o.surplusSheets : o.breakMargin) || 0;
      const totalUsed =
        Number(o.totalFactorySheetsUsed) > 0
          ? Number(o.totalFactorySheetsUsed)
          : liquid + surplus;
      const finalSheets = Number(o.totalFinalSheets) || 0;

      groupMap[key].ordersCount += 1;
      groupMap[key].totalFinalSheets += finalSheets;
      groupMap[key].fullSheetsNeeded += liquid;
      groupMap[key].breakMarginTotal += surplus;
      groupMap[key].totalFactorySheetsUsed += totalUsed;
      if (o.orderNumber) {
        groupMap[key].ordersList.push(o.orderNumber);
      }
    });

    return Object.values(groupMap).sort(
      (a, b) => b.totalFactorySheetsUsed - a.totalFactorySheetsUsed
    );
  }, [filteredOrders]);

  // Métricas Consolidadas para os Cards Superiores
  const metrics = useMemo(() => {
    const totalOrders = filteredOrders.length;

    // Folhas Líquidas
    const totalLiquidSheets = filteredOrders.reduce(
      (sum, o) => sum + (Number(o.fullSheetsNeeded) || 0),
      0
    );

    // Sobra (Acerto)
    const totalBreakMargin = filteredOrders.reduce(
      (sum, o) =>
        sum +
        Number(o.surplusSheets !== undefined ? o.surplusSheets : (o.breakMargin || 0)),
      0
    );

    // Soma Exata de Folhas Gastas de Fábrica
    const totalFactorySheets = filteredOrders.reduce((sum, o) => {
      const used = Number(o.totalFactorySheetsUsed);
      if (used > 0) return sum + used;
      const liquid = Number(o.fullSheetsNeeded) || 0;
      const surplus = Number(o.surplusSheets !== undefined ? o.surplusSheets : (o.breakMargin || 0));
      return sum + (liquid + surplus);
    }, 0);

    // Folhas Cortadas Finais Entregues
    const totalFinalSheets = filteredOrders.reduce(
      (sum, o) => sum + (Number(o.totalFinalSheets) || 0),
      0
    );

    // Pacotes Inteiros Representados
    const totalPackagesApprox = paperConsumptionGroup.reduce(
      (sum, g) => sum + Math.ceil(g.totalFactorySheetsUsed / (g.packageSheets || 250)),
      0
    );

    return {
      totalOrders,
      totalLiquidSheets,
      totalBreakMargin,
      totalFactorySheets,
      totalFinalSheets,
      totalPackagesApprox,
    };
  }, [filteredOrders, paperConsumptionGroup]);

  // Carga e distribuição por máquina de impressão
  const machineDistribution = useMemo(() => {
    const counts: Record<string, { orders: number; factorySheets: number }> = {};
    filteredOrders.forEach((o) => {
      const machineName = o.machine || 'Não Definida';
      if (!counts[machineName]) {
        counts[machineName] = { orders: 0, factorySheets: 0 };
      }
      const sheets =
        Number(o.totalFactorySheetsUsed) > 0
          ? Number(o.totalFactorySheetsUsed)
          : (Number(o.fullSheetsNeeded) || 0) +
            (Number(o.surplusSheets !== undefined ? o.surplusSheets : o.breakMargin) || 0);

      counts[machineName].orders += 1;
      counts[machineName].factorySheets += sheets;
    });
    return Object.entries(counts).sort((a, b) => b[1].factorySheets - a[1].factorySheets);
  }, [filteredOrders]);

  // Exportar Relatório em CSV
  const handleExportCSV = () => {
    const headers = [
      'Mês de Produção',
      'Tipo de Papel',
      'Código',
      'Formato do Papel (mm)',
      'Pacote Padrão (fls)',
      'Total O.S.',
      'Folhas Finais Produzidas',
      'Folhas Líquidas',
      'Sobra (Acerto) (fls)',
      'SOMA EXATA DE FOLHAS GASTAS',
      'PACOTES INTEIROS REPRESENTADOS',
    ];

    const currentFilterLabel =
      selectedMonth === 'TODOS' ? 'Todos os Meses' : canonicalizeMonthDisplay(selectedMonth);

    const rows = paperConsumptionGroup.map((g) => {
      const fullPackages = Math.floor(g.totalFactorySheetsUsed / g.packageSheets);
      const remainder = g.totalFactorySheetsUsed % g.packageSheets;
      const pacotesTexto = `${fullPackages} pct fechado(s) + ${remainder} fls (Teto: ${Math.ceil(
        g.totalFactorySheetsUsed / g.packageSheets
      )} pacotes)`;

      return [
        `"${currentFilterLabel}"`,
        `"${g.paperName}"`,
        `"${g.paperCode}"`,
        `"${g.widthMm}x${g.heightMm}"`,
        g.packageSheets,
        g.ordersCount,
        g.totalFinalSheets,
        g.fullSheetsNeeded,
        g.breakMarginTotal,
        g.totalFactorySheetsUsed,
        `"${pacotesTexto}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeName = selectedMonth === 'TODOS' ? 'geral' : selectedMonth.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `relatorio_diretor_consumo_pjerj_${safeName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 max-w-[100vw] py-6 space-y-6">
      {/* Top Banner com Indicador de Conexão em Tempo Real */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
              Módulo 5
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Coleção &apos;orders&apos; em Tempo Real ({allOrders.length} O.S.)</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-1.5">
            <LayoutDashboard className="w-5 h-5 text-emerald-600" />
            <span>Dashboard do Diretor: Controle de Consumo de Papel</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sincronização em tempo real dos números reais de produção e requisição de estoque no PJERJ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors border border-slate-300 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Relatório</span>
          </button>
        </div>
      </div>

      {/* FILTRO DE MÊS DE PRODUÇÃO (productionMonth: "Mês / Ano") */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Mês de Produção (productionMonth)
            </h3>
            <span className="text-[11px] text-slate-400 font-normal">
              &bull; Formato: &quot;Mês / Ano&quot;
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botão TODOS */}
            <button
              type="button"
              onClick={() => setSelectedMonth('TODOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedMonth === 'TODOS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Todos os Meses ({allOrders.length})
            </button>

            {/* Dropdown de Meses Registrados */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="TODOS">Todos os Meses</option>
              {availableMonths.map((m) => (
                <option key={m.norm} value={m.display}>
                  {m.display}
                </option>
              ))}
            </select>

            {/* Atalhos Rápidos para Meses Disponíveis */}
            {availableMonths.slice(0, 3).map((m) => {
              const isSelected =
                selectedMonth !== 'TODOS' &&
                normalizeProductionMonth(selectedMonth) === m.norm;
              return (
                <button
                  key={m.norm}
                  type="button"
                  onClick={() => setSelectedMonth(m.display)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {m.display}
                </button>
              );
            })}
          </div>
        </div>

        {/* Resumo do Filtro Ativo */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
          <span>
            Exibindo dados para:{' '}
            <strong className="text-slate-900 font-bold">
              {selectedMonth === 'TODOS'
                ? 'Todos os Meses Registrados'
                : canonicalizeMonthDisplay(selectedMonth)}
            </strong>{' '}
            ({filteredOrders.length} O.S. computadas)
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <RefreshCw className="w-3 h-3 text-emerald-600" />
            Atualização em tempo real: {lastSyncTime.toLocaleTimeString('pt-BR')}
          </span>
        </div>
      </div>

      {/* KPI INDICATORS - SOMA EXATA E GASTO TOTAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Folhas Gastas Totais */}
        <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white p-5 rounded-2xl shadow-md border border-emerald-700/60">
          <div className="flex items-center justify-between text-emerald-300 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Gasto Total de Folhas
            </span>
            <Layers className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">
            {metrics.totalFactorySheets.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-emerald-200/80 mt-1">
            Folhas inteiras de fábrica gastas
          </div>
        </div>

        {/* Folhas Líquidas */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Folhas Líquidas
            </span>
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-black font-mono text-slate-900">
            {metrics.totalLiquidSheets.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Folhas absorvidas no produto
          </div>
        </div>

        {/* Sobra / Acerto */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Sobra (Acerto)
            </span>
            <Radio className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-black font-mono text-amber-900">
            +{metrics.totalBreakMargin.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Margem de acerto de máquina
          </div>
        </div>

        {/* Pacotes Inteiros Representados */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Pacotes no Estoque
            </span>
            <Package className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-black font-mono text-slate-900">
            ~ {metrics.totalPackagesApprox}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Volumes fechados a requisitar
          </div>
        </div>

        {/* Total de O.S. Processadas */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Total de O.S.
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-black font-mono text-slate-900">
            {metrics.totalOrders}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ordens registradas no período
          </div>
        </div>
      </div>

      {/* TABELA CONSOLIDADA: AGRUPADA POR TIPO DE PAPEL */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Consumo Consolidado Agrupado por Tipo de Papel</span>
            </h3>
            <p className="text-xs text-slate-500">
              Soma exata de folhas gastas, folhas líquidas, sobra e pacotes inteiros correspondentes.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            {paperConsumptionGroup.length} Tipos de Papéis
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase text-[10px]">
                <th className="py-3 px-3">Papel (Estoque)</th>
                <th className="py-3 px-3">Formato do Papel</th>
                <th className="py-3 px-3 text-center">Pacote Padrão</th>
                <th className="py-3 px-3 text-center">Nº O.S.</th>
                <th className="py-3 px-3 text-right">Folhas Líquidas</th>
                <th className="py-3 px-3 text-right">Sobra (Acerto)</th>
                <th className="py-3 px-4 text-right bg-emerald-50 text-emerald-950 font-black">
                  SOMA EXATA DE FOLHAS GASTAS
                </th>
                <th className="py-3 px-4 text-center bg-amber-50 text-amber-950 font-black">
                  PACOTES INTEIROS REPRESENTADOS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paperConsumptionGroup.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhum consumo de papel registrado para o filtro selecionado (
                    {selectedMonth === 'TODOS'
                      ? 'Todos os Meses'
                      : canonicalizeMonthDisplay(selectedMonth)}
                    ).
                  </td>
                </tr>
              ) : (
                paperConsumptionGroup.map((group) => {
                  const fullPackages = Math.floor(
                    group.totalFactorySheetsUsed / (group.packageSheets || 250)
                  );
                  const remainderSheets =
                    group.totalFactorySheetsUsed % (group.packageSheets || 250);
                  const totalPackagesCeil = Math.ceil(
                    group.totalFactorySheetsUsed / (group.packageSheets || 250)
                  );

                  return (
                    <tr
                      key={group.paperName}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <strong className="text-slate-900 block">{group.paperName}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {group.paperCode} &bull; O.S.: {group.ordersList.join(', ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {group.widthMm} × {group.heightMm} mm
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                        {group.packageSheets} fls/pct
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {group.ordersCount}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-700 font-semibold">
                        {group.fullSheetsNeeded.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-700 font-semibold">
                        +{group.breakMarginTotal.toLocaleString('pt-BR')}
                      </td>
                      {/* SOMA EXATA DE FOLHAS GASTAS */}
                      <td className="py-3 px-4 text-right bg-emerald-50/70 border-x border-emerald-200">
                        <span className="text-sm font-black font-mono text-emerald-950">
                          {group.totalFactorySheetsUsed.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-[10px] text-emerald-700 block font-bold">
                          FOLHAS INTEIRAS
                        </span>
                      </td>
                      {/* QUANTOS PACOTES INTEIROS ISSO REPRESENTOU */}
                      <td className="py-3 px-4 text-center bg-amber-50/70 border-r border-amber-200">
                        <div className="font-mono font-black text-amber-950 text-sm">
                          {totalPackagesCeil} PACOTE{totalPackagesCeil > 1 ? 'S' : ''}
                        </div>
                        <div className="text-[10px] text-amber-800 font-medium">
                          ({fullPackages} pct fechado{fullPackages > 1 ? 's' : ''} +{' '}
                          {remainderSheets} fls)
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {paperConsumptionGroup.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-900">
                  <td colSpan={3} className="py-3 px-3 uppercase tracking-wider">
                    Total Geral do Período
                  </td>
                  <td className="py-3 px-3 text-center font-mono">
                    {metrics.totalOrders} O.S.
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-blue-300">
                    {metrics.totalLiquidSheets.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-amber-300">
                    +{metrics.totalBreakMargin.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right bg-emerald-950 text-emerald-300 font-black text-sm font-mono">
                    {metrics.totalFactorySheets.toLocaleString('pt-BR')} FL. INT.
                  </td>
                  <td className="py-3 px-4 text-center bg-amber-950 text-amber-300 font-black text-sm font-mono">
                    ~ {metrics.totalPackagesApprox} PACOTES
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Carga por Máquina de Impressão */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-600" />
          <span>Utilização e Consumo por Máquina de Impressão</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {machineDistribution.map(([machineName, data]) => {
            const pct =
              metrics.totalFactorySheets > 0
                ? Math.round((data.factorySheets / metrics.totalFactorySheets) * 1000) / 10
                : 0;

            return (
              <div
                key={machineName}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-sm text-slate-900">{machineName}</strong>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    {data.orders} O.S.
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-slate-800">
                  {data.factorySheets.toLocaleString('pt-BR')} fls gastas
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-500 block text-right font-semibold">
                  {pct}% do papel processado
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
