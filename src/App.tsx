/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GraphicProvider, useGraphic } from './context/GraphicContext';
import { Header, ActiveTab } from './components/Header';
import { OrderEmissionView } from './components/OrderEmissionView';
import { OrdersHistoryView } from './components/OrdersHistoryView';
import { KanbanBoard } from './components/KanbanBoard';
import { DirectorDashboard } from './components/DirectorDashboard';
import { BaseRegisters } from './components/BaseRegisters';
import { PrintA4OrderModal } from './components/PrintA4OrderModal';
import { PjerjLogo } from './components/PjerjLogo';
import { Columns3 } from 'lucide-react';
import { ServiceOrder } from './types';

const MainAppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('emission');
  const [orderToEdit, setOrderToEdit] = useState<ServiceOrder | null>(null);
  const [isKanbanActive, setIsKanbanActive] = useState<boolean>(false);
  const { selectedOrderForPrint, setSelectedOrderForPrint } = useGraphic();

  const handlePrintOrder = (order: ServiceOrder) => {
    setSelectedOrderForPrint(order);
  };

  const handleClosePrintModal = () => {
    setSelectedOrderForPrint(null);
  };

  const handleOpenNewOrder = () => {
    setOrderToEdit(null);
    setActiveTab('emission');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditOrder = (order: ServiceOrder) => {
    setOrderToEdit(order);
    setActiveTab('emission');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/60 font-sans selection:bg-blue-800 selection:text-white">
      {/* Institutional Header with PJERJ Seal and DIGRA - DIVISÃO GRÁFICA */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewOrder={handleOpenNewOrder}
        isKanbanActive={isKanbanActive}
        setIsKanbanActive={setIsKanbanActive}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-12 print:hidden">
        {activeTab === 'emission' && (
          <OrderEmissionView
            onPrintOrder={handlePrintOrder}
            onNavigateKanban={() => {
              setIsKanbanActive(true);
              setActiveTab('kanban');
            }}
            orderToEdit={orderToEdit}
            onClearOrderToEdit={() => setOrderToEdit(null)}
          />
        )}

        {activeTab === 'history' && (
          <OrdersHistoryView
            onPrintOrder={handlePrintOrder}
            onEditOrder={handleEditOrder}
            onOpenNewOrder={handleOpenNewOrder}
          />
        )}

        {activeTab === 'kanban' && (
          isKanbanActive ? (
            <KanbanBoard
              onPrintOrder={handlePrintOrder}
              onOpenNewOrder={handleOpenNewOrder}
            />
          ) : (
            <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-xs">
              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
                <Columns3 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Painel Kanban Inativo</h3>
              <p className="text-sm text-slate-500 mt-2 mb-6">
                O fluxo visual das 9 etapas de produção está oculto por padrão. Clique no botão abaixo ou no botão switch "Ativar Painel Kanban" no menu superior para exibir as colunas sem alterar nenhuma O.S. já emitida.
              </p>
              <button
                type="button"
                onClick={() => setIsKanbanActive(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-sm cursor-pointer active:scale-95"
              >
                <Columns3 className="w-4 h-4 stroke-[2.5]" />
                <span>Ativar Painel Kanban Agora</span>
              </button>
            </div>
          )
        )}

        {activeTab === 'dashboard' && <DirectorDashboard />}

        {activeTab === 'registers' && <BaseRegisters />}
      </main>

      {/* Printable A4 Modal (for window.print and preview) */}
      <PrintA4OrderModal
        order={selectedOrderForPrint}
        onClose={handleClosePrintModal}
      />

      {/* Institutional Judicial Footer */}
      <footer className="bg-[#0b1329] text-slate-400 border-t border-[#1e293b] py-6 px-4 text-xs print:hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PjerjLogo showText={false} size={36} className="shrink-0" imageClassName="invert brightness-0" />
            <div>
              <div className="text-white font-black text-sm tracking-wide">
                DIGRA - DIVISÃO GRÁFICA
              </div>
              <p className="text-[11px] text-slate-300 font-bold uppercase">
                PODER JUDICIÁRIO DO ESTADO DO RIO DE JANEIRO &bull; Diretoria-Geral de Administração
              </p>
            </div>
          </div>

          <div className="text-center sm:text-right text-[11px] text-slate-500 space-y-0.5">
            <p className="font-medium text-slate-400">
              Sistema de Engenharia de Corte & Gestão de Ordens de Serviço
            </p>
            <p>
              Logística estrita de produção & consumo de papel &bull; Versão 2026.1
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <GraphicProvider>
      <MainAppContent />
    </GraphicProvider>
  );
}
