import React, { useState } from 'react';
import { useGraphic } from '../context/GraphicContext';
import { PaperFactory, CutFormat, ServiceCatalog, Responsible, Machine } from '../types';
import {
  Database,
  Layers,
  Scissors,
  FileText,
  User,
  Printer,
  Plus,
  Pencil,
  Trash2,
  X,
  RotateCcw,
} from 'lucide-react';

export const BaseRegisters: React.FC = () => {
  const {
    papers,
    addPaper,
    updatePaper,
    deletePaper,
    formats,
    addFormat,
    updateFormat,
    deleteFormat,
    services,
    addService,
    updateService,
    deleteService,
    responsibles,
    addResponsible,
    updateResponsible,
    deleteResponsible,
    machines,
    addMachine,
    deleteMachine,
    resetDatabaseToDefault,
  } = useGraphic();

  const [activeSubTab, setActiveSubTab] = useState<
    'responsibles' | 'machines' | 'formats' | 'papers' | 'services'
  >('responsibles');

  // Modal State
  const [modalType, setModalType] = useState<
    'responsible' | 'machine' | 'format' | 'paper' | 'service' | null
  >(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form Fields
  const [respName, setRespName] = useState('');
  const [respRole, setRespRole] = useState('Operador Gráfico');

  const [machName, setMachName] = useState('');
  const [machTech, setMachTech] = useState('Impressão Offset');

  const [fmtName, setFmtName] = useState('');
  const [fmtWidth, setFmtWidth] = useState<number>(210);
  const [fmtHeight, setFmtHeight] = useState<number>(297);
  const [fmtDesc, setFmtDesc] = useState('');

  const [paperCode, setPaperCode] = useState('');
  const [paperName, setPaperName] = useState('');
  const [paperWidth, setPaperWidth] = useState<number>(660);
  const [paperHeight, setPaperHeight] = useState<number>(960);
  const [paperPkg, setPaperPkg] = useState<number>(250);
  const [paperGram, setPaperGram] = useState<number>(75);
  const [paperColor, setPaperColor] = useState('Branco');
  const [paperDesc, setPaperDesc] = useState('');

  const [srvCode, setSrvCode] = useState('');
  const [srvName, setSrvName] = useState('');
  const [srvCategory, setSrvCategory] = useState('');
  const [srvDesc, setSrvDesc] = useState('');

  // Handlers
  const handleOpenResponsibleModal = (r?: Responsible) => {
    if (r) {
      setEditingItem(r);
      setRespName(r.name);
      setRespRole(r.role || 'Operador Gráfico');
    } else {
      setEditingItem(null);
      setRespName('');
      setRespRole('Operador Gráfico');
    }
    setModalType('responsible');
  };

  const handleOpenMachineModal = () => {
    setMachName('');
    setMachTech('Impressão Offset');
    setModalType('machine');
  };

  const handleOpenFormatModal = (f?: CutFormat) => {
    if (f) {
      setEditingItem(f);
      setFmtName(f.name);
      setFmtWidth(f.widthMm);
      setFmtHeight(f.heightMm);
      setFmtDesc(f.description || '');
    } else {
      setEditingItem(null);
      setFmtName('');
      setFmtWidth(210);
      setFmtHeight(297);
      setFmtDesc('');
    }
    setModalType('format');
  };

  const handleOpenPaperModal = (p?: PaperFactory) => {
    if (p) {
      setEditingItem(p);
      setPaperCode(p.code);
      setPaperName(p.name);
      setPaperWidth(p.widthMm);
      setPaperHeight(p.heightMm);
      setPaperPkg(p.packageSheets || 250);
      setPaperGram(p.grammage || 75);
      setPaperColor(p.color || 'Branco');
      setPaperDesc(p.description || '');
    } else {
      setEditingItem(null);
      setPaperCode('');
      setPaperName('');
      setPaperWidth(660);
      setPaperHeight(960);
      setPaperPkg(250);
      setPaperGram(75);
      setPaperColor('Branco');
      setPaperDesc('');
    }
    setModalType('paper');
  };

  const handleOpenServiceModal = (s?: ServiceCatalog) => {
    if (s) {
      setEditingItem(s);
      setSrvCode(s.code);
      setSrvName(s.name);
      setSrvCategory(s.category || 'IMP');
      setSrvDesc(s.description || '');
    } else {
      setEditingItem(null);
      setSrvCode('655-');
      setSrvName('');
      setSrvCategory('IMP');
      setSrvDesc('');
    }
    setModalType('service');
  };

  // Submit forms
  const handleSaveResponsible = (e: React.FormEvent) => {
    e.preventDefault();
    if (!respName.trim()) return;

    if (editingItem) {
      updateResponsible(editingItem.id, respName.trim(), respRole);
    } else {
      addResponsible(respName.trim(), respRole);
    }
    setModalType(null);
  };

  const handleSaveMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!machName.trim()) return;
    addMachine(machName.trim(), machTech);
    setModalType(null);
  };

  const handleSaveFormat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fmtName || fmtWidth <= 0 || fmtHeight <= 0) return;
    if (editingItem) {
      updateFormat(editingItem.id, {
        name: fmtName,
        widthMm: fmtWidth,
        heightMm: fmtHeight,
        description: fmtDesc,
      });
    } else {
      addFormat({
        name: fmtName,
        widthMm: fmtWidth,
        heightMm: fmtHeight,
        description: fmtDesc,
      });
    }
    setModalType(null);
  };

  const handleSavePaper = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperName || paperWidth <= 0 || paperHeight <= 0) return;
    if (editingItem) {
      updatePaper(editingItem.id, {
        code: paperCode || paperName.substring(0, 4).toUpperCase(),
        name: paperName,
        widthMm: paperWidth,
        heightMm: paperHeight,
        packageSheets: paperPkg,
        grammage: paperGram,
        color: paperColor,
        description: paperDesc,
      });
    } else {
      addPaper({
        code: paperCode || paperName.substring(0, 4).toUpperCase(),
        name: paperName,
        widthMm: paperWidth,
        heightMm: paperHeight,
        packageSheets: paperPkg,
        grammage: paperGram,
        color: paperColor,
        description: paperDesc,
      });
    }
    setModalType(null);
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvCode || !srvName) return;
    if (editingItem) {
      updateService(editingItem.id, {
        code: srvCode,
        name: srvName,
        category: srvCategory,
        description: srvDesc,
      });
    } else {
      addService({
        code: srvCode,
        name: srvName,
        category: srvCategory,
        description: srvDesc,
      });
    }
    setModalType(null);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 max-w-[100vw] py-6 space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
              Módulo Administrativo
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-600" />
              <span>Cadastros Administrativos (CRUD Completo)</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão completa das coleções: Responsáveis (com edição), Máquinas, Formatos ABNT, Papéis de Estoque e Serviços.
          </p>
        </div>

        <button
          onClick={() => {
            if (window.confirm('Restaurar o banco para as tabelas iniciais oficiais do PJERJ?')) {
              resetDatabaseToDefault();
            }
          }}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors border border-slate-200"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restaurar Tabelas PJERJ</span>
        </button>
      </div>

      {/* Subtab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('responsibles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'responsibles'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Responsáveis ({responsibles.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('machines')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'machines'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Máquinas ({machines.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('formats')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'formats'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>Formatos de Corte ABNT ({formats.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('papers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'papers'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Papéis & Estoque ({papers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('services')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'services'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Catálogo de Serviços ({services.length})</span>
        </button>
      </div>

      {/* SUBTAB: RESPONSÁVEIS (COM EDIÇÃO IMPLEMENTADA) */}
      {activeSubTab === 'responsibles' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Responsáveis pelo Preenchimento (Dropdown da O.S.)
              </h3>
              <p className="text-xs text-slate-500">
                Padrão inicial: FLÁVIO, ENÉIAS, RICARDO (Permite Adicionar, Editar e Excluir)
              </p>
            </div>
            <button
              onClick={() => handleOpenResponsibleModal()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Responsável</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {responsibles.map((r) => (
              <div
                key={r.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between"
              >
                <div>
                  <strong className="text-sm font-bold text-slate-900 block">{r.name}</strong>
                  <span className="text-[11px] text-slate-500">{r.role || 'Operador Gráfico'}</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Botão EDITAR Responsável */}
                  <button
                    onClick={() => handleOpenResponsibleModal(r)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Editar Responsável"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {/* Botão EXCLUIR Responsável */}
                  <button
                    onClick={() => {
                      if (window.confirm(`Excluir responsável ${r.name}?`)) {
                        deleteResponsible(r.id);
                      }
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Excluir Responsável"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB: MÁQUINAS */}
      {activeSubTab === 'machines' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Máquinas de Impressão da DIGRA
              </h3>
              <p className="text-xs text-slate-500">
                Padrão inicial: Heidelberg Bicolor, Sakurai
              </p>
            </div>
            <button
              onClick={handleOpenMachineModal}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Máquina</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {machines.map((m) => (
              <div
                key={m.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between"
              >
                <div>
                  <strong className="text-sm font-bold text-slate-900 block">{m.name}</strong>
                  <span className="text-[11px] text-slate-500">{m.tech || 'Offset'}</span>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir máquina ${m.name}?`)) {
                      deleteMachine(m.id);
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-red-600 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB: FORMATOS DE CORTE (TABELA ABNT) */}
      {activeSubTab === 'formats' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Formatos de Corte Finais (Tabela ABNT)
              </h3>
              <p className="text-xs text-slate-500">
                A4, SRA4, A3, SRA3, Carta, Duplo Ofício, Placa, Simples, Grafit Capa, Pacote, Revista, Ficha
              </p>
            </div>
            <button
              onClick={() => handleOpenFormatModal()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Formato</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Nome do Formato</th>
                  <th className="py-2.5 px-3">Largura</th>
                  <th className="py-2.5 px-3">Altura</th>
                  <th className="py-2.5 px-3">Dimensões Finais (mm)</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formats.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{f.name}</td>
                    <td className="py-2.5 px-3 font-mono">{f.widthMm} mm</td>
                    <td className="py-2.5 px-3 font-mono">{f.heightMm} mm</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                      {f.widthMm} × {f.heightMm} mm
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenFormatModal(f)}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Excluir formato ${f.name}?`)) {
                              deleteFormat(f.id);
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: PAPÉIS DE FÁBRICA & ESTOQUE */}
      {activeSubTab === 'papers' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tipos de Papéis e Formatos (Dados de Estoque)
              </h3>
              <p className="text-xs text-slate-500">
                Adesivo Fosco, Cartão Triplex, Cartolinas, Couchés, Kraft, Opaline, Offsets, Vergês
              </p>
            </div>
            <button
              onClick={() => handleOpenPaperModal()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Papel</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Nome do Papel</th>
                  <th className="py-2.5 px-3">Dimensões (mm)</th>
                  <th className="py-2.5 px-3 text-center">Pacote Fechado</th>
                  <th className="py-2.5 px-3">Gramatura</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {papers.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{p.code}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{p.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-800">
                      {p.widthMm} × {p.heightMm} mm
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-700 bg-amber-50/50">
                      {p.packageSheets} fls / pacote
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {p.grammage ? `${p.grammage}g` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenPaperModal(p)}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Excluir papel ${p.name}?`)) {
                              deletePaper(p.id);
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: CATÁLOGO DE SERVIÇOS */}
      {activeSubTab === 'services' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Catálogo de Serviços da Divisão Gráfica (DIGRA - PJERJ)
              </h3>
              <p className="text-xs text-slate-500">
                Busca normalizada com ou sem traço (ex: 655-8753 ou 6558753)
              </p>
            </div>
            <button
              onClick={() => handleOpenServiceModal()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Serviço</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Código Oficial</th>
                  <th className="py-2.5 px-3">Descrição do Trabalho</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Finalidade</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{s.code}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{s.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {s.category || 'IMP'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{s.description || '-'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenServiceModal(s)}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Excluir serviço ${s.name}?`)) {
                              deleteService(s.id);
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL DE CADASTRO/EDIÇÃO ================= */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {modalType === 'responsible' && (editingItem ? 'Editar Responsável' : 'Novo Responsável')}
                {modalType === 'machine' && 'Nova Máquina de Impressão'}
                {modalType === 'format' && (editingItem ? 'Editar Formato ABNT' : 'Novo Formato ABNT')}
                {modalType === 'paper' && (editingItem ? 'Editar Papel' : 'Novo Papel')}
                {modalType === 'service' && (editingItem ? 'Editar Serviço' : 'Novo Serviço')}
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM: Responsible (Com edição suportada) */}
            {modalType === 'responsible' && (
              <form onSubmit={handleSaveResponsible} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Responsável:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: FLÁVIO / ENÉIAS / RICARDO"
                    value={respName}
                    onChange={(e) => setRespName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cargo / Função:
                  </label>
                  <input
                    type="text"
                    value={respRole}
                    onChange={(e) => setRespRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    {editingItem ? 'Salvar Alteração' : 'Cadastrar Responsável'}
                  </button>
                </div>
              </form>
            )}

            {/* FORM: Machine */}
            {modalType === 'machine' && (
              <form onSubmit={handleSaveMachine} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome da Máquina:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Heidelberg Bicolor / Sakurai"
                    value={machName}
                    onChange={(e) => setMachName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tecnologia / Descrição:
                  </label>
                  <input
                    type="text"
                    value={machTech}
                    onChange={(e) => setMachTech(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    Salvar Máquina
                  </button>
                </div>
              </form>
            )}

            {/* FORM: Format */}
            {modalType === 'format' && (
              <form onSubmit={handleSaveFormat} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Formato:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: A4 / SRA3 / Revista"
                    value={fmtName}
                    onChange={(e) => setFmtName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Largura (mm):
                    </label>
                    <input
                      type="number"
                      required
                      value={fmtWidth}
                      onChange={(e) => setFmtWidth(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Altura (mm):
                    </label>
                    <input
                      type="number"
                      required
                      value={fmtHeight}
                      onChange={(e) => setFmtHeight(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    Salvar Formato
                  </button>
                </div>
              </form>
            )}

            {/* FORM: Paper */}
            {modalType === 'paper' && (
              <form onSubmit={handleSavePaper} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Código:
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: KRF-110"
                      value={paperCode}
                      onChange={(e) => setPaperCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pacote Fechado (fls):
                    </label>
                    <input
                      type="number"
                      required
                      value={paperPkg}
                      onChange={(e) => setPaperPkg(parseInt(e.target.value) || 100)}
                      className="w-full bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-950"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Papel:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Kraft 110g"
                    value={paperName}
                    onChange={(e) => setPaperName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Largura (mm):
                    </label>
                    <input
                      type="number"
                      required
                      value={paperWidth}
                      onChange={(e) => setPaperWidth(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Altura (mm):
                    </label>
                    <input
                      type="number"
                      required
                      value={paperHeight}
                      onChange={(e) => setPaperHeight(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    Salvar Papel
                  </button>
                </div>
              </form>
            )}

            {/* FORM: Service */}
            {modalType === 'service' && (
              <form onSubmit={handleSaveService} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Código Oficial:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 655-8753"
                      value={srvCode}
                      onChange={(e) => setSrvCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Categoria Oficial:
                    </label>
                    <select
                      value={srvCategory}
                      onChange={(e) => setSrvCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
                    >
                      <option value="CORREIOS">CORREIOS</option>
                      <option value="IMP">IMP</option>
                      <option value="CAPA">CAPA</option>
                      <option value="FICHAS">FICHAS</option>
                      <option value="LIVROS">LIVROS</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Descrição do Trabalho:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cautela de objeto"
                    value={srvName}
                    onChange={(e) => setSrvName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    Salvar Serviço
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
