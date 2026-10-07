import React, { useState, useMemo } from 'react';
import { useGraphic } from '../context/GraphicContext';
import {
  LayoutDashboard,
  Calendar,
  Layers,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  Percent,
  Package,
  FileText,
  BarChart3,
} from 'lucide-react';

export const DirectorDashboard: React.FC = () => {
  const { orders } = useGraphic();

  // Filtro de Datas Inicial e Final (Requisito Obrigatório)
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Filtragem estrita por período de emissão
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const orderDate = o.dateEmission || (o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '');
      if (!startDate && !endDate) return true;
      if (startDate && orderDate && orderDate < startDate) return false;
      if (endDate && orderDate && orderDate > endDate) return false;
      return true;
    });
  }, [orders, startDate, endDate]);

  // Agrupamento Consolidado por Tipo de Papel (MANDATÓRIO: soma exata de folhas gastas e pacotes inteiros representados)
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
      const key = o.paperName || o.paperCode;
      if (!groupMap[key]) {
        groupMap[key] = {
          paperId: o.paperId,
          paperName: o.paperName,
          paperCode: o.paperCode,
          packageSheets: o.packageSheets || 250,
          widthMm: o.paperWidthMm,
          heightMm: o.paperHeightMm,
          ordersCount: 0,
          totalFinalSheets: 0,
          fullSheetsNeeded: 0,
          breakMarginTotal: 0,
          totalFactorySheetsUsed: 0,
          ordersList: [],
        };
      }

      groupMap[key].ordersCount += 1;
      groupMap[key].totalFinalSheets += o.totalFinalSheets;
      groupMap[key].fullSheetsNeeded += o.fullSheetsNeeded;
      groupMap[key].breakMarginTotal += o.breakMargin;
      groupMap[key].totalFactorySheetsUsed += o.totalFactorySheetsUsed;
      groupMap[key].ordersList.push(o.orderNumber);
    });

    return Object.values(groupMap).sort(
      (a, b) => b.totalFactorySheetsUsed - a.totalFactorySheetsUsed
    );
  }, [filteredOrders]);

  // Métricas Consolidadas
  const metrics = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalFactorySheets = filteredOrders.reduce(
      (sum, o) => sum + o.totalFactorySheetsUsed,
      0
    );
    const totalFinalSheets = filteredOrders.reduce(
      (sum, o) => sum + o.totalFinalSheets,
      0
    );
    const totalBreakMargin = filteredOrders.reduce(
      (sum, o) => sum + o.breakMargin,
      0
    );

    // Soma de pacotes inteiros aproximados
    const totalPackagesApprox = paperConsumptionGroup.reduce(
      (sum, g) => sum + Math.ceil(g.totalFactorySheetsUsed / g.packageSheets),
      0
    );

    return {
      totalOrders,
      totalFactorySheets,
      totalFinalSheets,
      totalBreakMargin,
      totalPackagesApprox,
    };
  }, [filteredOrders, paperConsumptionGroup]);

  // Carga por máquina
  const machineDistribution = useMemo(() => {
    const counts: Record<string, { orders: number; factorySheets: number }> = {};
    filteredOrders.forEach((o) => {
      if (!counts[o.machine]) counts[o.machine] = { orders: 0, factorySheets: 0 };
      counts[o.machine].orders += 1;
      counts[o.machine].factorySheets += o.totalFactorySheetsUsed;
    });
    return Object.entries(counts).sort((a, b) => b[1].factorySheets - a[1].factorySheets);
  }, [filteredOrders]);

  // Exportar CSV
  const handleExportCSV = () => {
    const headers = [
      'Tipo de Papel',
      'Código',
      'Formato do Papel (mm)',
      'Pacote Padrão (fls)',
      'Total O.S.',
      'Folhas Finais Produzidas',
      'Folhas Líquidas',
      'Margem de Quebra (fls)',
      'SOMA EXATA DE FOLHAS GASTAS',
      'PACOTES INTEIROS REPRESENTADOS',
    ];

    const rows = paperConsumptionGroup.map((g) => {
      const fullPackages = Math.floor(g.totalFactorySheetsUsed / g.packageSheets);
      const remainder = g.totalFactorySheetsUsed % g.packageSheets;
      const pacotesTexto = `${fullPackages} pct fechado(s) + ${remainder} fls (Teto: ${Math.ceil(
        g.totalFactorySheetsUsed / g.packageSheets
      )} pacotes)`;

      return [
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
    link.setAttribute(
      'download',
      `relatorio_consumo_digra_pjerj_${startDate}_a_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 max-w-[100vw] py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
              Módulo 5
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-emerald-600" />
              <span>Dashboard do Diretor: Controle de Consumo de Papel</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Relatório gerencial de consumo de papel e requisição de pacotes de estoque no PJERJ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors border border-slate-300"
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

      {/* FILTRO DE DATAS (Data Inicial e Data Final - Requisito Obrigatório) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Filtro de Período de Produção
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Data Inicial:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Data Final:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick buttons */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-09-01');
                  setEndDate(todayStr);
                }}
                className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
              >
                Mês Atual
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-01-01');
                  setEndDate('2026-12-31');
                }}
                className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
              >
                Ano 2026
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI INDICATORS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Folhas Gastas */}
        <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white p-5 rounded-2xl shadow-md border border-emerald-700/60">
          <div className="flex items-center justify-between text-emerald-300 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Soma de Folhas Gastas
            </span>
            <Layers className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">
            {metrics.totalFactorySheets.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-emerald-200/80 mt-1">
            Folhas inteiras de fábrica consumidas
          </div>
        </div>

        {/* Pacotes Inteiros Representados */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Pacotes Inteiros Representados
            </span>
            <Package className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-black font-mono text-slate-900">
            ~ {metrics.totalPackagesApprox}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Volumes fechados a requisitar no almoxarifado
          </div>
        </div>

        {/* Folhas Finais Entregues */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Folhas Cortadas Finais
            </span>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-black font-mono text-slate-900">
            {metrics.totalFinalSheets.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tiragem final entregue às serventias
          </div>
        </div>

        {/* Total de O.S. */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Total de O.S. Processadas
            </span>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-black font-mono text-slate-900">
            {metrics.totalOrders}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ordens de serviço atendidas no período
          </div>
        </div>
      </div>

      {/* TABELA CONSOLIDADA: AGRUPADA POR TIPO DE PAPEL COM FOLHAS E PACOTES INTEIROS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Consumo Consolidado Agrupado por Tipo de Papel</span>
            </h3>
            <p className="text-xs text-slate-500">
              Soma exata de folhas gastas e correspondência exata de pacotes inteiros representados no período de {startDate} até {endDate}.
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
                <th className="py-3 px-3 text-center">Tamanho Pacote</th>
                <th className="py-3 px-3 text-center">Nº O.S.</th>
                <th className="py-3 px-3 text-right">Folhas Finais</th>
                <th className="py-3 px-3 text-right">Quebra (Acerto)</th>
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
                    Nenhum consumo de papel registrado para o período de {startDate} até {endDate}.
                  </td>
                </tr>
              ) : (
                paperConsumptionGroup.map((group) => {
                  const fullPackages = Math.floor(group.totalFactorySheetsUsed / group.packageSheets);
                  const remainderSheets = group.totalFactorySheetsUsed % group.packageSheets;
                  const totalPackagesCeil = Math.ceil(group.totalFactorySheetsUsed / group.packageSheets);

                  return (
                    <tr key={group.paperName} className="hover:bg-slate-50 transition-colors">
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
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {group.totalFinalSheets.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-700 font-semibold">
                        +{group.breakMarginTotal.toLocaleString('pt-BR')} fls
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
                          ({fullPackages} pct fechado{fullPackages > 1 ? 's' : ''} + {remainderSheets} fls)
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
                  <td className="py-3 px-3 text-right font-mono">
                    {metrics.totalFinalSheets.toLocaleString('pt-BR')}
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

      {/* Carga por Máquina */}
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
