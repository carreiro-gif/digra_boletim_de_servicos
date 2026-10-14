import React, { useState } from 'react';
import { useGraphic } from '../context/GraphicContext';
import { PlusCircle, LayoutDashboard, Columns3, FileText, Database, Cloud, Wifi, Sparkles, RefreshCw, History } from 'lucide-react';

export type ActiveTab = 'emission' | 'history' | 'kanban' | 'dashboard' | 'registers';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewOrder: () => void;
  isKanbanActive: boolean;
  setIsKanbanActive: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewOrder,
  isKanbanActive,
  setIsKanbanActive,
}) => {
  const { orders, isFirebaseActive, reimportarSismat } = useGraphic();
  const [isReimporting, setIsReimporting] = useState(false);

  const inProductionCount = orders.filter((o) => o.status !== 'Pronto').length;

  const handleSyncSismat = async () => {
    setIsReimporting(true);
    try {
      await reimportarSismat();
    } finally {
      setIsReimporting(false);
    }
  };

  return (
    <header className="bg-[#0b1329] border-b border-[#1e293b] text-white shadow-lg sticky top-0 z-40 print:hidden">
      {/* Top Judicial Ribbon */}
      <div className="bg-[#060b17] px-4 sm:px-6 lg:px-8 py-1.5 border-b border-slate-800/80 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold text-slate-300">TRIBUNAL DE JUSTIÇA DO ESTADO DO RIO DE JANEIRO</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">DIGRA - DIVISÃO GRÁFICA</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            {isFirebaseActive ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Cloud className="w-3.5 h-3.5" />
                <span>Firestore Nuvem Ativo</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-blue-400 font-medium" title="Sincronização em tempo real entre abas via canal local">
                <Wifi className="w-3.5 h-3.5" />
                <span>Sincronização Local</span>
              </span>
            )}
          </div>
          <span className="text-slate-700">|</span>
          <button
            onClick={handleSyncSismat}
            disabled={isReimporting}
            className="flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-700 transition-colors cursor-pointer"
            title="Sincronizar fichas técnicas do SISMAT (2025/2026) com Firebase Firestore"
          >
            <RefreshCw className={`w-3 h-3 text-indigo-400 ${isReimporting ? 'animate-spin' : ''}`} />
            <span>SISMAT: <strong>{orders.length} O.S.</strong></span>
          </button>
          <span className="text-slate-700">|</span>
          <span>Em Produção: <strong className="text-amber-400">{inProductionCount} O.S.</strong></span>
        </div>
      </div>

      {/* Main Brand & Navigation Bar (Full Width) */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left Side: Brasão Oficial PJERJ + DIGRA - DIVISÃO GRÁFICA */}
        <div className="flex items-center gap-4">
          <img src="/logo-pjerj.png" alt="Logo PJERJ" className="w-12 h-12 object-contain invert brightness-0" />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-wide text-slate-300 uppercase">
              PODER JUDICIÁRIO DO ESTADO DO RIO DE JANEIRO
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>DIGRA - DIVISÃO GRÁFICA</span>
            </h1>
            <p className="text-xs text-slate-300 font-bold">
              Gestão de Ordens de Serviço &bull; Logística de Papel
            </p>
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('emission')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'emission'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-300" />
            <span>Emissão de O.S.</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-sky-300" />
            <span>Histórico de O.S.</span>
          </button>

          {/* Kanban Tab & Switch Control */}
          <div className="flex items-center gap-1.5 shrink-0 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                if (!isKanbanActive) {
                  setIsKanbanActive(true);
                }
                setActiveTab('kanban');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                activeTab === 'kanban'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                  : isKanbanActive
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title={isKanbanActive ? 'Acessar Painel Kanban' : 'Painel Kanban (Inativo por padrão - clique para ativar)'}
            >
              <Columns3 className={`w-4 h-4 ${isKanbanActive ? 'text-amber-300' : 'text-slate-400'}`} />
              <span>Painel Kanban</span>
              {inProductionCount > 0 && isKanbanActive && (
                <span className="ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-500 text-slate-950">
                  {inProductionCount}
                </span>
              )}
            </button>

            {/* Switch / Toggle: Ativar Painel Kanban */}
            <label
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800/90 border border-slate-700/80 text-xs shrink-0 cursor-pointer select-none transition-colors"
              title="Ativar ou ocultar visualização do Painel Kanban de 9 colunas"
            >
              <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
                Ativar Painel Kanban
              </span>
              <input
                type="checkbox"
                checked={isKanbanActive}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsKanbanActive(checked);
                  if (checked) {
                    setActiveTab('kanban');
                  } else if (activeTab === 'kanban') {
                    setActiveTab('emission');
                  }
                }}
                className="sr-only"
              />
              <div
                className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors duration-200 ease-in-out ${
                  isKanbanActive ? 'bg-amber-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    isKanbanActive ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </label>
          </div>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-emerald-300" />
            <span>Dashboard Diretor</span>
          </button>

          <button
            onClick={() => setActiveTab('registers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'registers'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Database className="w-4 h-4 text-purple-300" />
            <span>Cadastros Base</span>
          </button>
        </nav>

        {/* Right Side: Quick Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-3.5 py-2 rounded-lg shadow-md hover:shadow-lg transition-all text-sm active:scale-95"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>Nova O.S.</span>
          </button>
        </div>
      </div>
    </header>
  );
};
