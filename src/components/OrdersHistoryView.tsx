import React, { useState, useMemo } from 'react';
import { useGraphic } from '../context/GraphicContext';
import { ServiceOrder } from '../types';
import {
  FileText,
  Search,
  History,
  Printer,
  Edit3,
  Trash2,
  X,
  Filter,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface OrdersHistoryViewProps {
  onPrintOrder: (order: ServiceOrder) => void;
  onEditOrder: (order: ServiceOrder) => void;
  onOpenNewOrder: () => void;
}

export const OrdersHistoryView: React.FC<OrdersHistoryViewProps> = ({
  onPrintOrder,
  onEditOrder,
  onOpenNewOrder,
}) => {
  const {
    orders,
    deleteOrder,
    loadOlderOrdersFromFirestore,
    isFetchingOlderOrders,
    hasLoadedAllOrders,
  } = useGraphic();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [olderFetchFeedback, setOlderFetchFeedback] = useState<string | null>(null);

  // 1. FILTRO DE SEGURANÇA VISUAL (Iniciar do Zero):
  // Oculta registros importados em lote do SISMAT (emissor ou criador "DIGRA / SISMAT").
  // A tabela de histórico e os contadores visuais exibem estritamente as Ordens de Serviço
  // emitidas ativamente na tela pelos operadores (ex: criadas para testes ou rotina real).
  const visibleOrders = useMemo(() => {
    return orders.filter((o) => {
      const creator = (o.createdBy || '').trim().toUpperCase();
      const obs = (o.observation || '').toUpperCase();
      return (
        creator !== 'DIGRA / SISMAT' &&
        !creator.includes('SISMAT') &&
        !obs.includes('IMPORTADO VIA SISMAT')
      );
    });
  }, [orders]);

  // Filtragem inteligente de O.S. sobre as ordens visíveis de operadores
  const filteredOrders = useMemo(() => {
    let result = visibleOrders;

    if (statusFilter !== 'todos') {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (!searchTerm.trim()) return result;
    const term = searchTerm.toLowerCase().trim();

    return result.filter((o) => {
      const matchNumber = o.orderNumber?.toLowerCase().includes(term);
      const matchBs =
        o.bsNumber?.toString().includes(term) ||
        o.bsCodeKey?.toLowerCase().includes(term);
      const matchService =
        o.serviceName?.toLowerCase().includes(term) ||
        o.serviceCode?.toLowerCase().includes(term);
      const matchPaper = o.paperName?.toLowerCase().includes(term);
      const matchMonth = o.productionMonth?.toLowerCase().includes(term);
      const matchCreator = o.createdBy?.toLowerCase().includes(term);
      const matchMachine = o.machine?.toLowerCase().includes(term);
      return (
        matchNumber ||
        matchBs ||
        matchService ||
        matchPaper ||
        matchMonth ||
        matchCreator ||
        matchMachine
      );
    });
  }, [visibleOrders, searchTerm, statusFilter]);

  const handleFetchOlder = async () => {
    const count = await loadOlderOrdersFromFirestore();
    setOlderFetchFeedback(
      count > 0
        ? `+${count} O.S. antigas carregadas do Firestore!`
        : 'Histórico completo sincronizado com sucesso.'
    );
    setTimeout(() => setOlderFetchFeedback(null), 4000);
  };

  const handleDeleteOrder = async (order: ServiceOrder) => {
    const confirmed = window.confirm(
      `Deseja realmente excluir permanentemente a O.S. ${order.orderNumber}?\n\nEsta ação removerá o registro do banco de dados Firebase Firestore e não poderá ser desfeita.`
    );
    if (!confirmed) return;
    try {
      await deleteOrder(order.id);
    } catch (err) {
      console.error('Erro ao excluir O.S.:', err);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho da Aba Histórico de O.S. */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
            <History className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Histórico de O.S.
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                {visibleOrders.length} {visibleOrders.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulta unificada, busca por demanda, edição no formulário, exclusão e reimpressão A4 em PDF
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenNewOrder}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-4 py-2 rounded-xl shadow-xs transition-all text-xs cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova Emissão de O.S.</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por Nº O.S., serviço, papel, mês de produção, responsável ou máquina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && !hasLoadedAllOrders && searchTerm.trim()) {
                  await handleFetchOlder();
                }
              }}
              className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtro por Status */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="Aguardando Início">Aguardando Início</option>
              <option value="Em Impressão">Em Impressão</option>
              <option value="Em Corte">Em Corte</option>
              <option value="Em Acabamento">Em Acabamento</option>
              <option value="Pronto">Pronto</option>
            </select>

            {/* Botão de Busca de O.S. Antigas (Firestore sob Demanda) */}
            {!hasLoadedAllOrders ? (
              <button
                type="button"
                onClick={handleFetchOlder}
                disabled={isFetchingOlderOrders}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-2xs disabled:opacity-60"
                title="Buscar O.S. mais antigas no histórico do Firestore (sob demanda, otimizando leituras)"
              >
                {isFetchingOlderOrders ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
                    <span>Buscando no Firestore...</span>
                  </>
                ) : (
                  <>
                    <History className="w-3.5 h-3.5 text-blue-600" />
                    <span>Buscar O.S. Antigas</span>
                  </>
                )}
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 whitespace-nowrap text-center">
                ✓ Todo Histórico Carregado
              </span>
            )}
          </div>
        </div>

        {/* Feedback visual de carregamento sob demanda */}
        {olderFetchFeedback && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs px-3.5 py-2 rounded-xl flex items-center justify-between">
            <span className="font-semibold">{olderFetchFeedback}</span>
            <button
              onClick={() => setOlderFetchFeedback(null)}
              className="text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Tabela Oficial do Histórico de O.S. */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-700">Listagem Completa</span>
            <span>&bull;</span>
            <span>Exibindo <strong>{filteredOrders.length}</strong> de <strong>{visibleOrders.length}</strong> O.S.</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-bold uppercase text-[10px]">
                <th className="py-3 px-3.5">Nº O.S.</th>
                <th className="py-3 px-3">Produção</th>
                <th className="py-3 px-3">Responsável</th>
                <th className="py-3 px-3">Máquina</th>
                <th className="py-3 px-3.5">Serviço</th>
                <th className="py-3 px-3.5">Papel & Formato</th>
                <th className="py-3 px-2.5 text-center">Img/Chapa</th>
                <th className="py-3 px-3 text-center">Gasto Total (Fls)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <p className="font-bold text-slate-700 text-sm">Nenhuma Ordem de Serviço encontrada.</p>
                    {searchTerm && (
                      <p className="text-xs text-slate-500 mt-1">
                        Nenhum resultado corresponde à busca &quot;{searchTerm}&quot;.
                      </p>
                    )}
                    {!hasLoadedAllOrders && (
                      <p className="text-xs text-slate-500 mt-3">
                        Procurando um registro mais antigo?{' '}
                        <button
                          type="button"
                          onClick={handleFetchOlder}
                          disabled={isFetchingOlderOrders}
                          className="text-blue-600 underline font-bold hover:text-blue-800 cursor-pointer"
                        >
                          {isFetchingOlderOrders
                            ? 'Consultando Firestore...'
                            : 'Clique aqui para carregar o histórico antigo do Firestore'}
                        </button>
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-blue-50/40 transition-colors"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {order.productionMonth ||
                          (order.dateEmission
                            ? new Date(order.dateEmission + 'T12:00:00').toLocaleDateString('pt-BR')
                            : '-')}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {order.createdBy || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {order.machine || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-800 max-w-xs">
                        <div className="line-clamp-1 font-semibold">{order.serviceName}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{order.serviceCode}</span>
                          {order.materialType && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] uppercase font-bold">
                              {order.materialType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="line-clamp-1 font-medium">{order.paperName}</div>
                        <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            {order.cutFormatName} ({order.yieldPerSheet}p)
                          </span>
                          {order.finalCutSize && (
                            <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Refile: {order.finalCutSize}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2.5 text-center font-mono font-semibold text-slate-600">
                        {order.imagesPerPlate || 1}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40 whitespace-nowrap">
                        {order.totalFactorySheetsUsed.toLocaleString('pt-BR')} fls
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            order.status === 'Pronto'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : order.status === 'Aguardando Início'
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : order.status === 'Em Acabamento'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      {/* Ações completas: Editar, Excluir, Reimprimir PDF */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-center">
                          {/* 1. Editar O.S. (Leva de volta para Emissão) */}
                          <button
                            type="button"
                            onClick={() => onEditOrder(order)}
                            className="p-1.5 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                            title="Editar esta O.S. no formulário de Emissão"
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-all border border-blue-200 cursor-pointer"
                            title="Reimprimir Boletim de Trabalho A4"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrdersHistoryView;
