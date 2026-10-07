import React, { useState, useMemo } from 'react';
import { useGraphic } from '../context/GraphicContext';
import { OrderStatus, ServiceOrder } from '../types';
import {
  Columns3,
  Clock,
  Printer,
  Scissors,
  Layers,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
} from 'lucide-react';

// Paleta Executiva e Profissional Sóbria (Slate, Zinc, Navy discreto, Muted Purple e Sage Green)
const KANBAN_COLUMNS: Array<{
  id: OrderStatus;
  title: string;
  icon: React.ElementType;
  headerTextColor: string;
  badgeBg: string;
  columnBg: string;
  borderClass: string;
}> = [
  {
    id: 'Aguardando Início',
    title: 'Aguardando Início',
    icon: Clock,
    headerTextColor: 'text-slate-700',
    badgeBg: 'bg-slate-200 text-slate-700',
    columnBg: 'bg-slate-100/70',
    borderClass: 'border-slate-200',
  },
  {
    id: 'Em Impressão',
    title: 'Em Impressão',
    icon: Printer,
    headerTextColor: 'text-slate-800',
    badgeBg: 'bg-slate-800 text-slate-100',
    columnBg: 'bg-slate-100/70',
    borderClass: 'border-slate-300',
  },
  {
    id: 'Em Corte',
    title: 'Em Corte / Guilhotina',
    icon: Scissors,
    headerTextColor: 'text-zinc-700',
    badgeBg: 'bg-zinc-200 text-zinc-800',
    columnBg: 'bg-zinc-100/70',
    borderClass: 'border-zinc-300',
  },
  {
    id: 'Em Acabamento',
    title: 'Em Acabamento',
    icon: Layers,
    headerTextColor: 'text-stone-700',
    badgeBg: 'bg-stone-200 text-stone-800',
    columnBg: 'bg-stone-100/70',
    borderClass: 'border-stone-300',
  },
  {
    id: 'Pronto',
    title: 'Pronto / Expedição',
    icon: CheckCircle2,
    headerTextColor: 'text-emerald-900',
    badgeBg: 'bg-emerald-100 text-emerald-900',
    columnBg: 'bg-emerald-50/40',
    borderClass: 'border-emerald-200',
  },
];

interface KanbanBoardProps {
  onPrintOrder: (order: ServiceOrder) => void;
  onOpenNewOrder: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ onPrintOrder, onOpenNewOrder }) => {
  const { orders, machines, updateOrderStatus } = useGraphic();

  // Filters
  const [search, setSearch] = useState('');
  const [filterMachine, setFilterMachine] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  // Dragging state
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<OrderStatus | null>(null);

  const statusSequence: OrderStatus[] = [
    'Aguardando Início',
    'Em Impressão',
    'Em Corte',
    'Em Acabamento',
    'Pronto',
  ];

  const handleMoveOrder = (orderId: string, currentStatus: OrderStatus, direction: 'next' | 'prev') => {
    const currentIndex = statusSequence.indexOf(currentStatus);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= 0 && nextIndex < statusSequence.length) {
      updateOrderStatus(orderId, statusSequence[nextIndex]);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedOrderId(id);
  };

  const handleDragOver = (e: React.DragEvent, columnId: OrderStatus) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: OrderStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedOrderId;
    if (id) {
      updateOrderStatus(id, targetStatus);
    }
    setDraggedOrderId(null);
    setDragOverColumn(null);
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterMachine !== 'ALL' && o.machine !== filterMachine) return false;
      if (filterPriority !== 'ALL' && o.priority !== filterPriority) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.serviceName.toLowerCase().includes(q) ||
          o.serviceCode?.toLowerCase().includes(q) ||
          o.serviceCategory?.toLowerCase().includes(q) ||
          o.paperName.toLowerCase().includes(q) ||
          o.createdBy.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, search, filterMachine, filterPriority]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 max-w-[100vw] py-6 space-y-6">
      {/* Title & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300">
                Painel Executivo
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Columns3 className="w-5 h-5 text-slate-700" />
                <span>Fluxo Físico de Produção (Kanban DIGRA)</span>
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Monitoramento discreto e sóbrio das etapas físicas do papel na gráfica judicial.
            </p>
          </div>

          <button
            onClick={onOpenNewOrder}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-xs"
          >
            + Nova O.S.
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por O.S., serviço, responsável..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
            />
          </div>

          <div>
            <select
              value={filterMachine}
              onChange={(e) => setFilterMachine(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-slate-400"
            >
              <option value="ALL">Todas as Máquinas</option>
              {machines.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-slate-400"
            >
              <option value="ALL">Todas as Prioridades</option>
              <option value="Normal">Normal</option>
              <option value="Urgente">Urgente</option>
              <option value="Alta Prioridade">Alta Prioridade</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5-Column Kanban Board com Paleta Executiva e Sóbria */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col, colIndex) => {
          const columnOrders = filteredOrders.filter((o) => o.status === col.id);
          const ColIcon = col.icon;
          const isOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex flex-col ${col.columnBg} rounded-2xl p-3 border-2 transition-all min-h-[560px] ${
                isOver
                  ? 'border-slate-500 bg-slate-200/60 shadow-md scale-[1.01]'
                  : col.borderClass
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <ColIcon className={`w-4 h-4 ${col.headerTextColor}`} />
                  <h3 className={`font-bold text-xs tracking-tight ${col.headerTextColor}`}>
                    {col.title}
                  </h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${col.badgeBg}`}
                >
                  {columnOrders.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
                {columnOrders.length === 0 ? (
                  <div className="h-36 flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-xl text-slate-400 p-4 text-center">
                    <p className="text-[11px] font-medium text-slate-500">Sem O.S. nesta etapa</p>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Arraste um cartão para cá
                    </span>
                  </div>
                ) : (
                  columnOrders.map((order) => {
                    const isUrgent =
                      order.priority === 'Urgente' ||
                      order.priority === 'Alta Prioridade';

                    return (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, order.id)}
                        className={`bg-white rounded-xl p-3.5 shadow-xs border transition-all cursor-grab active:cursor-grabbing hover:shadow-md ${
                          isUrgent ? 'border-amber-300/80' : 'border-slate-200'
                        }`}
                      >
                        {/* Top Bar: Number & Produção */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {order.orderNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9.5px] font-bold text-slate-800 bg-slate-100 border border-slate-200 truncate max-w-[130px]">
                            {order.productionMonth || (order.dateEmission ? new Date(order.dateEmission + 'T12:00:00').toLocaleDateString('pt-BR') : '-')}
                          </span>
                        </div>

                        {/* Service Title & Category */}
                        <div className="mb-2">
                          {order.serviceCategory && (
                            <span className="inline-block px-1.5 py-0.5 mb-1 rounded text-[9px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {order.serviceCategory}
                            </span>
                          )}
                          <h4 className="font-bold text-xs text-slate-900 leading-snug line-clamp-2">
                            {order.serviceName}
                          </h4>
                        </div>

                        {/* Machine & Responsável */}
                        <div className="space-y-1 mb-2.5 text-[11px] text-slate-600">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Printer className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{order.machine}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{order.createdBy}</span>
                          </div>
                        </div>

                        {/* Paper & Factory Sheets Badge */}
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/80 mb-2.5 text-[10px]">
                          <div className="flex items-center justify-between text-slate-600 mb-1">
                            <span className="truncate">{order.paperName}</span>
                            <span className="font-mono text-slate-800 font-bold">
                              {order.cutFormatName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 font-semibold">
                            <span className="text-slate-500">Gasto de Papel:</span>
                            <strong className="text-slate-900 font-mono text-[11px]">
                              {order.totalFactorySheetsUsed} fls
                            </strong>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1">
                          <button
                            type="button"
                            disabled={colIndex === 0}
                            onClick={() => handleMoveOrder(order.id, order.status, 'prev')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                            title="Mover para etapa anterior"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onPrintOrder(order)}
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-200 transition-colors"
                            title="Visualizar e Imprimir O.S. (A4)"
                          >
                            <Printer className="w-3 h-3" />
                            <span>PDF A4</span>
                          </button>

                          <button
                            type="button"
                            disabled={colIndex === KANBAN_COLUMNS.length - 1}
                            onClick={() => handleMoveOrder(order.id, order.status, 'next')}
                            className="p-1 rounded text-slate-700 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:text-slate-400"
                            title="Avançar para próxima etapa"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
