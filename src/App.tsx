/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GraphicProvider, useGraphic } from './context/GraphicContext';
import { Header, ActiveTab } from './components/Header';
import { OrderEmissionView } from './components/OrderEmissionView';
import { KanbanBoard } from './components/KanbanBoard';
import { DirectorDashboard } from './components/DirectorDashboard';
import { BaseRegisters } from './components/BaseRegisters';
import { PrintA4OrderModal } from './components/PrintA4OrderModal';
import { PjerjLogo } from './components/PjerjLogo';
import { ServiceOrder } from './types';

const MainAppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('emission');
  const { selectedOrderForPrint, setSelectedOrderForPrint } = useGraphic();

  const handlePrintOrder = (order: ServiceOrder) => {
    setSelectedOrderForPrint(order);
  };

  const handleClosePrintModal = () => {
    setSelectedOrderForPrint(null);
  };

  const handleOpenNewOrder = () => {
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
      />

      {/* Main View Area */}
      <main className="flex-1 pb-12 print:hidden">
        {activeTab === 'emission' && (
          <OrderEmissionView
            onPrintOrder={handlePrintOrder}
            onNavigateKanban={() => setActiveTab('kanban')}
          />
        )}

        {activeTab === 'kanban' && (
          <KanbanBoard
            onPrintOrder={handlePrintOrder}
            onOpenNewOrder={handleOpenNewOrder}
          />
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
            <PjerjLogo showText={false} size={36} className="shrink-0" />
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
