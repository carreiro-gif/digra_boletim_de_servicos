import React, { useState, useMemo, useEffect } from 'react';
import { useGraphic } from '../context/GraphicContext';
import { db, isFirebaseConfigured } from '../firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { ServiceOrder } from '../types';
import {
  LayoutDashboard,
  Calendar,
  Layers,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  Package,
  CheckCircle2,
  Radio,
  RefreshCw,
  Warehouse,
  Boxes,
  Save,
  Check,
  AlertTriangle,
  ArrowDownRight,
  PlusCircle,
  HelpCircle,
  X,
  SlidersHorizontal,
  Filter,
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

// Interface do Estoque Base por Tipo de Papel
export interface EstoqueBaseItem {
  paperId: string;
  paperName: string;
  paperCode: string;
  packageSheets: number;
  initialSheets: number;
  initialPackages: number;
  lastUpdated?: number;
  updatedBy?: string;
}

const ESTOQUE_BASE_LOCAL_KEY = 'pjerj_digra_estoque_base_v1';

export const DirectorDashboard: React.FC = () => {
  const { orders: contextOrders, papers } = useGraphic();

  // Sub-abas do Dashboard do Diretor: 'visao_geral' ou 'balanco_estoque'
  const [activeSubTab, setActiveSubTab] = useState<'visao_geral' | 'balanco_estoque'>('visao_geral');

  // 1. REATIVIDADE EM TEMPO REAL COM FIREBASE E ORDERS
  const [rawFirestoreOrders, setRawFirestoreOrders] = useState<ServiceOrder[]>([]);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setRawFirestoreOrders(contextOrders);
      return;
    }

    try {
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

          // Deduplicação absoluta por ID para zerar qualquer possibilidade de registros duplicados
          const dedup = new Map<string, ServiceOrder>();
          for (const ord of remoteList) {
            if (ord.id) dedup.set(ord.id, ord);
          }
          setRawFirestoreOrders(Array.from(dedup.values()));
          setIsLiveConnected(true);
          setLastSyncTime(new Date());
        },
        (error) => {
          console.warn('[DirectorDashboard] Erro no listener direto de orders, usando cache local:', error);
          setRawFirestoreOrders(contextOrders);
        }
      );

      return () => unsub();
    } catch (err) {
      console.warn('[DirectorDashboard] Falha ao registrar onSnapshot:', err);
      setRawFirestoreOrders(contextOrders);
    }
  }, []);

  const rawOrders = useMemo(() => {
    const source = (isLiveConnected && rawFirestoreOrders.length > 0) ? rawFirestoreOrders : contextOrders;
    const dedupMap = new Map<string, ServiceOrder>();
    for (const ord of source) {
      if (ord && ord.id) {
        dedupMap.set(ord.id, ord);
      }
    }
    return Array.from(dedupMap.values());
  }, [rawFirestoreOrders, contextOrders, isLiveConnected]);

  // 1. CORREÇÃO DO FILTRO DE DADOS (Zerar o Histórico do SISMAT):
  // Ignora RIGOROSAMENTE todas as ordens com criador "DIGRA / SISMAT", contendo "SISMAT" ou observação "IMPORTADO VIA SISMAT".
  // Se não houver ordens manuais criadas pelos operadores na tela, a lista ficará VAZIA (comprimento 0) e o painel zerará tudo!
  const allManualOrders = useMemo(() => {
    return rawOrders.filter((order) => {
      const creator = (order.createdBy || '').toUpperCase().trim();
      const obs = (order.observation || '').toUpperCase();
      const num = (order.orderNumber || '').toUpperCase();

      const isSismat =
        creator === 'DIGRA / SISMAT' ||
        creator.includes('SISMAT') ||
        obs.includes('IMPORTADO VIA SISMAT') ||
        num.startsWith('SISMAT-');

      return !isSismat;
    });
  }, [rawOrders]);

  // 2. CADASTRO BASE DE ESTOQUE ('estoque_base')
  // Armazena e sincroniza a Quantidade Inicial em Estoque por papel
  const [estoqueBaseMap, setEstoqueBaseMap] = useState<Record<string, EstoqueBaseItem>>(() => {
    try {
      const local = localStorage.getItem(ESTOQUE_BASE_LOCAL_KEY);
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      console.warn('Erro ao carregar estoque base local:', e);
    }
    return {};
  });

  const [savingStockId, setSavingStockId] = useState<string | null>(null);
  const [saveSuccessStockId, setSaveSuccessStockId] = useState<string | null>(null);

  // Listener para sincronizar a coleção 'estoque_base' do Firestore
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    try {
      const unsub = onSnapshot(
        collection(db, 'estoque_base'),
        (snapshot) => {
          const map: Record<string, EstoqueBaseItem> = {};
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as EstoqueBaseItem;
            // indexa pelo paperId ou nome
            const key = docSnap.id;
            map[key] = {
              paperId: data.paperId || key,
              paperName: data.paperName || key,
              paperCode: data.paperCode || '',
              packageSheets: Number(data.packageSheets) || 250,
              initialSheets: Number(data.initialSheets) || 0,
              initialPackages: Number(data.initialPackages) || 0,
              lastUpdated: data.lastUpdated || Date.now(),
              updatedBy: data.updatedBy || 'Diretoria',
            };
          });
          if (Object.keys(map).length > 0) {
            setEstoqueBaseMap((prev) => ({ ...prev, ...map }));
            localStorage.setItem(ESTOQUE_BASE_LOCAL_KEY, JSON.stringify(map));
          }
        },
        (err) => {
          console.warn('[DirectorDashboard] Erro listener estoque_base:', err);
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn('[DirectorDashboard] Falha ao conectar estoque_base:', e);
    }
  }, []);

  // Função para salvar Estoque Inicial de um papel
  const handleSaveEstoqueBase = async (
    paperId: string,
    paperName: string,
    paperCode: string,
    packageSheets: number,
    initialSheetsInput: number,
    mode: 'sheets' | 'packages'
  ) => {
    const pkgSheets = packageSheets > 0 ? packageSheets : 250;
    let finalSheets = 0;
    let finalPackages = 0;

    if (mode === 'sheets') {
      finalSheets = Math.max(0, Math.floor(initialSheetsInput));
      finalPackages = Math.floor(finalSheets / pkgSheets);
    } else {
      finalPackages = Math.max(0, Math.floor(initialSheetsInput));
      finalSheets = finalPackages * pkgSheets;
    }

    const payload: EstoqueBaseItem = {
      paperId,
      paperName,
      paperCode,
      packageSheets: pkgSheets,
      initialSheets: finalSheets,
      initialPackages: finalPackages,
      lastUpdated: Date.now(),
      updatedBy: 'Diretor / DIGRA',
    };

    setSavingStockId(paperId);

    // 1. Atualiza estado local e localStorage
    const updatedMap = { ...estoqueBaseMap, [paperId]: payload };
    setEstoqueBaseMap(updatedMap);
    try {
      localStorage.setItem(ESTOQUE_BASE_LOCAL_KEY, JSON.stringify(updatedMap));
    } catch (e) {
      console.error(e);
    }

    // 2. Persiste na coleção 'estoque_base' do Firestore
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'estoque_base', paperId), payload, { merge: true });
      } catch (err) {
        console.error('Erro ao salvar estoque_base no Firebase:', err);
      }
    }

    setSavingStockId(null);
    setSaveSuccessStockId(paperId);
    setTimeout(() => {
      setSaveSuccessStockId(null);
    }, 2500);
  };

  // 3. FILTRO DE MÊS DE PRODUÇÃO
  const availableMonths = useMemo(() => {
    const map = new Map<string, string>();

    allManualOrders.forEach((o) => {
      const rawMonth = (o.productionMonth || o.dateEmission || '').trim();
      if (rawMonth) {
        const norm = normalizeProductionMonth(rawMonth);
        if (!map.has(norm)) {
          map.set(norm, canonicalizeMonthDisplay(rawMonth));
        }
      }
    });

    // Adiciona o mês corrente se desejado
    const currentNorm = normalizeProductionMonth('Outubro / 2026');
    if (!map.has(currentNorm)) {
      map.set(currentNorm, 'Outubro / 2026');
    }

    return Array.from(map.entries())
      .map(([norm, display]) => ({ norm, display }))
      .sort((a, b) => b.display.localeCompare(a.display));
  }, [allManualOrders]);

  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');

  // Ordens filtradas estritamente após ignorar SISMAT e aplicar filtro de mês
  const filteredOrders = useMemo(() => {
    if (selectedMonth === 'TODOS') {
      return allManualOrders;
    }

    const selectedNorm = normalizeProductionMonth(selectedMonth);

    return allManualOrders.filter((o) => {
      const orderMonthNorm = normalizeProductionMonth(o.productionMonth || o.dateEmission);
      return orderMonthNorm === selectedNorm;
    });
  }, [allManualOrders, selectedMonth]);

  // 4. LISTA DINÂMICA DE TODOS OS TIPOS DE PAPÉIS ATIVOS CADASTRADOS NA GRÁFICA
  const availablePapersList = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        code: string;
        packageSheets: number;
        grammage?: number;
        widthMm?: number;
        heightMm?: number;
      }
    >();

    // 1. Papéis padrão/ativos da gráfica
    papers.forEach((p) => {
      map.set(p.id, {
        id: p.id,
        name: p.name,
        code: p.code || '',
        packageSheets: p.packageSheets || 250,
        grammage: p.grammage,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
      });
    });

    // 2. Papéis das ordens emitidas
    allManualOrders.forEach((o) => {
      const pId = o.paperId;
      const pName = o.paperName?.trim();
      const key = pId || pName;
      if (key && !map.has(key)) {
        const existingByName = Array.from(map.values()).find(
          (item) => pName && item.name.toLowerCase() === pName.toLowerCase()
        );
        if (!existingByName) {
          map.set(key, {
            id: key,
            name: o.paperName || key,
            code: o.paperCode || '',
            packageSheets: Number(o.packageSheets) || 250,
            widthMm: Number(o.paperWidthMm) || 0,
            heightMm: Number(o.paperHeightMm) || 0,
          });
        }
      }
    });

    // 3. Papéis cadastrados na base de estoque inicial
    Object.values(estoqueBaseMap).forEach((item) => {
      if (item.paperId && !map.has(item.paperId)) {
        const existingByName = Array.from(map.values()).find(
          (p) => item.paperName && p.name.toLowerCase() === item.paperName.toLowerCase()
        );
        if (!existingByName) {
          map.set(item.paperId, {
            id: item.paperId,
            name: item.paperName || item.paperId,
            code: item.paperCode || '',
            packageSheets: item.packageSheets || 250,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [papers, allManualOrders, estoqueBaseMap]);

  // 5. AGRUPAMENTO CONSOLIDADO POR TIPO DE PAPEL COM BALANÇO EM TEMPO REAL
  // RECALCULO DE CONSUMO DE ESTOQUE BASEADO EM ARRAY LIMPO (.reduce() puro, sem mutação residual)
  // Fórmula Estrita de Varredura por Tipo de Papel:
  // TotalFolhasGastasDoPapel = orders.filter(o => o.paperId === papelId && o.createdBy !== 'DIGRA / SISMAT').reduce((acc, current) => acc + current.totalFinalSheets, 0);
  const paperConsumptionGroup = useMemo(() => {
    return availablePapersList.map((paper) => {
      const papelId = paper.id;
      const paperName = paper.name;
      const paperCode = paper.code || '';
      const pkgSheets = paper.packageSheets || 250;

      // Filtro rigoroso por papel sobre o array de ordens ativas
      const matchingOrders = filteredOrders.filter((o) => {
        const creator = (o.createdBy || '').trim().toUpperCase();
        const obs = (o.observation || '').toUpperCase();
        const isSismat =
          creator === 'DIGRA / SISMAT' ||
          creator.includes('SISMAT') ||
          obs.includes('IMPORTADO VIA SISMAT');
        if (isSismat) return false;

        // 1. Prioridade absoluta para o paperId: se a ordem possuir paperId, compara estritamente pelo ID
        if (o.paperId && papelId) {
          return o.paperId === papelId;
        }

        // 2. Fallback apenas se a ordem for antiga/legada e não possuir paperId
        return (
          (o.paperName && paperName && o.paperName.trim().toLowerCase() === paperName.trim().toLowerCase()) ||
          (paperCode && o.paperCode && o.paperCode.trim().toLowerCase() === paperCode.toLowerCase())
        );
      });

      // Varredura estrita e pura com .reduce() do início ao fim (SEM acumulação residual na memória)
      const ordersCount = matchingOrders.length;
      const totalFinalSheets = matchingOrders.reduce(
        (acc, current) => acc + (Number(current.totalFinalSheets) || 0),
        0
      );
      const fullSheetsNeeded = matchingOrders.reduce(
        (acc, current) => acc + (Number(current.fullSheetsNeeded) || 0),
        0
      );
      const breakMarginTotal = matchingOrders.reduce(
        (acc, current) =>
          acc +
          Number(current.surplusSheets !== undefined ? current.surplusSheets : (current.breakMargin || 0)),
        0
      );
      const totalFactorySheetsUsed = matchingOrders.reduce((acc, current) => {
        const used = Number(current.totalFactorySheetsUsed);
        if (used > 0) return acc + used;
        const liquid = Number(current.fullSheetsNeeded) || 0;
        const surplus = Number(
          current.surplusSheets !== undefined ? current.surplusSheets : (current.breakMargin || 0)
        );
        return acc + (liquid + surplus);
      }, 0);

      // Busca Estoque Inicial no 'estoque_base'
      const estoqueBaseInfo =
        estoqueBaseMap[papelId] ||
        estoqueBaseMap[paperName] ||
        Object.values(estoqueBaseMap).find(
          (item) =>
            item.paperId === papelId ||
            (item.paperName && item.paperName.toLowerCase() === paperName.toLowerCase()) ||
            (paperCode && item.paperCode && item.paperCode.toLowerCase() === paperCode.toLowerCase())
        );

      const initialStockSheets = estoqueBaseInfo ? Number(estoqueBaseInfo.initialSheets) || 0 : 0;
      const saldoAtualSheets = initialStockSheets - totalFactorySheetsUsed;
      const ordersList = matchingOrders.map((o) => o.orderNumber).filter(Boolean) as string[];

      return {
        paperId: papelId,
        paperName: paperName,
        paperCode: paperCode,
        packageSheets: pkgSheets,
        widthMm: paper.widthMm || 0,
        heightMm: paper.heightMm || 0,
        ordersCount,
        totalFinalSheets,
        fullSheetsNeeded,
        breakMarginTotal,
        totalFactorySheetsUsed,
        initialStockSheets,
        saldoAtualSheets,
        ordersList,
      };
    }).sort((a, b) => {
      const aHasActivity = a.totalFactorySheetsUsed > 0 || a.initialStockSheets > 0;
      const bHasActivity = b.totalFactorySheetsUsed > 0 || b.initialStockSheets > 0;
      if (aHasActivity && !bHasActivity) return -1;
      if (!aHasActivity && bHasActivity) return 1;
      return b.totalFactorySheetsUsed - a.totalFactorySheetsUsed || a.paperName.localeCompare(b.paperName);
    });
  }, [availablePapersList, filteredOrders, estoqueBaseMap]);

  // Métricas Consolidadas para os Cards Superiores
  const metrics = useMemo(() => {
    // Se filteredOrders estiver vazio (sem O.S. manuais), TUDO É ZERO!
    if (filteredOrders.length === 0) {
      return {
        totalOrders: 0,
        totalLiquidSheets: 0,
        totalBreakMargin: 0,
        totalFactorySheets: 0,
        totalFinalSheets: 0,
        totalPackagesApprox: 0,
        totalInitialStockSheets: Object.values(estoqueBaseMap).reduce(
          (sum, i) => sum + (Number(i.initialSheets) || 0),
          0
        ),
        totalSaldoSheets: Object.values(estoqueBaseMap).reduce(
          (sum, i) => sum + (Number(i.initialSheets) || 0),
          0
        ),
      };
    }

    const totalOrders = filteredOrders.length;

    const totalLiquidSheets = filteredOrders.reduce(
      (sum, o) => sum + (Number(o.fullSheetsNeeded) || 0),
      0
    );

    const totalBreakMargin = filteredOrders.reduce(
      (sum, o) =>
        sum +
        Number(o.surplusSheets !== undefined ? o.surplusSheets : (o.breakMargin || 0)),
      0
    );

    const totalFactorySheets = filteredOrders.reduce((sum, o) => {
      const used = Number(o.totalFactorySheetsUsed);
      if (used > 0) return sum + used;
      const liquid = Number(o.fullSheetsNeeded) || 0;
      const surplus = Number(o.surplusSheets !== undefined ? o.surplusSheets : (o.breakMargin || 0));
      return sum + (liquid + surplus);
    }, 0);

    const totalFinalSheets = filteredOrders.reduce(
      (sum, o) => sum + (Number(o.totalFinalSheets) || 0),
      0
    );

    const totalPackagesApprox = paperConsumptionGroup.reduce(
      (sum, g) => sum + Math.ceil(g.totalFactorySheetsUsed / (g.packageSheets || 250)),
      0
    );

    const totalInitialStockSheets = paperConsumptionGroup.reduce(
      (sum, g) => sum + g.initialStockSheets,
      0
    );

    const totalSaldoSheets = totalInitialStockSheets - totalFactorySheets;

    return {
      totalOrders,
      totalLiquidSheets,
      totalBreakMargin,
      totalFactorySheets,
      totalFinalSheets,
      totalPackagesApprox,
      totalInitialStockSheets,
      totalSaldoSheets,
    };
  }, [filteredOrders, paperConsumptionGroup, estoqueBaseMap]);

  // 4. SELETOR REATIVO DE PAPEL PARA AUDITORIA (BI)
  const [selectedPaperFilter, setSelectedPaperFilter] = useState<string>('all');

  // Função para testar correspondência de papel em uma O.S. (Prioridade absoluta para paperId)
  const isOrderMatchingPaper = (o: ServiceOrder, filterId: string): boolean => {
    if (filterId === 'all') return true;

    const target = availablePapersList.find((p) => p.id === filterId);
    const targetName = (target ? target.name : filterId).toLowerCase().trim();
    const targetCode = target?.code ? target.code.toLowerCase().trim() : '';

    const oPaperId = (o.paperId || '').trim();
    const oPaperName = (o.paperName || '').toLowerCase().trim();
    const oPaperCode = (o.paperCode || '').toLowerCase().trim();

    // 1. Se ambos possuírem ID de papel cadastrado, a validação é estritamente pelo ID
    if (oPaperId && target && target.id) {
      return oPaperId === target.id;
    }
    if (oPaperId && oPaperId === filterId) return true;

    // 2. Fallback para registros antigos sem ID de papel: correspondência exata de código ou nome
    if (targetCode && oPaperCode && oPaperCode === targetCode) return true;
    if (targetName && oPaperName && oPaperName === targetName) return true;

    return false;
  };

  // Objeto do papel atualmente selecionado
  const selectedPaperObject = useMemo(() => {
    if (selectedPaperFilter === 'all') return null;
    return availablePapersList.find((p) => p.id === selectedPaperFilter) || null;
  }, [selectedPaperFilter, availablePapersList]);

  // Ordens filtradas por mês e papel isolado
  const paperFilteredOrders = useMemo(() => {
    if (selectedPaperFilter === 'all') {
      return filteredOrders;
    }
    return filteredOrders.filter((o) => isOrderMatchingPaper(o, selectedPaperFilter));
  }, [filteredOrders, selectedPaperFilter, availablePapersList]);

  // MÉTRICAS REATIVAS ISOLADAS PARA OS 4 CARDS SUPERIORES DE BUSINESS INTELLIGENCE
  const auditCardMetrics = useMemo(() => {
    const isAll = selectedPaperFilter === 'all';
    const totalOrders = paperFilteredOrders.length;

    const totalLiquidSheets = paperFilteredOrders.reduce(
      (sum, o) => sum + (Number(o.fullSheetsNeeded) || 0),
      0
    );

    const totalBreakMargin = paperFilteredOrders.reduce(
      (sum, o) =>
        sum +
        Number(o.surplusSheets !== undefined ? o.surplusSheets : (o.breakMargin || 0)),
      0
    );

    const totalFactorySheets = paperFilteredOrders.reduce((sum, o) => {
      const used = Number(o.totalFactorySheetsUsed);
      if (used > 0) return sum + used;
      const liquid = Number(o.fullSheetsNeeded) || 0;
      const surplus = Number(o.surplusSheets !== undefined ? o.surplusSheets : (o.breakMargin || 0));
      return sum + (liquid + surplus);
    }, 0);

    const totalFinalSheets = paperFilteredOrders.reduce(
      (sum, o) => sum + (Number(o.totalFinalSheets) || 0),
      0
    );

    if (isAll) {
      // Modo Consolidado (Todos os Papéis)
      const totalPackagesApprox = paperConsumptionGroup.reduce(
        (sum, g) => sum + Math.ceil(g.totalFactorySheetsUsed / (g.packageSheets || 250)),
        0
      );

      const totalInitialStockSheets = Object.values(estoqueBaseMap).reduce(
        (sum, i) => sum + (Number(i.initialSheets) || 0),
        0
      );

      const totalSaldoSheets = totalInitialStockSheets - totalFactorySheets;

      return {
        isAll: true,
        paperName: 'Visualizar Todos os Papéis',
        paperCode: '',
        packageSheets: 250,
        totalOrders,
        totalLiquidSheets,
        totalBreakMargin,
        totalFactorySheets,
        totalFinalSheets,
        totalPackagesApprox,
        initialStockSheets: totalInitialStockSheets,
        saldoAtualSheets: totalSaldoSheets,
        saldoPackages: Math.floor(totalSaldoSheets / 250),
        status: 'consolidated' as const,
        statusLabel: `${paperConsumptionGroup.length} Papéis Monitorados`,
        statusBadgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
      };
    }

    // Modo Isolado por Papel Específico
    const paperObj = selectedPaperObject;
    const paperName = paperObj?.name || selectedPaperFilter;
    const paperCode = paperObj?.code || '';
    const pkgSheets = paperObj?.packageSheets || 250;

    // Busca Estoque Inicial rigoroso no 'estoque_base'
    const baseInfo =
      estoqueBaseMap[selectedPaperFilter] ||
      (paperObj ? estoqueBaseMap[paperObj.id] : null) ||
      Object.values(estoqueBaseMap).find(
        (item) =>
          item.paperId === selectedPaperFilter ||
          (paperObj && item.paperName?.toLowerCase() === paperObj.name.toLowerCase()) ||
          (paperCode && item.paperCode === paperCode)
      );

    const initialStockSheets = baseInfo ? Number(baseInfo.initialSheets) || 0 : 0;
    const saldoAtualSheets = initialStockSheets - totalFactorySheets;
    const saldoPackages = Math.floor(saldoAtualSheets / pkgSheets);
    const totalPackagesApprox = Math.ceil(totalFactorySheets / pkgSheets);

    // Status do Saldo com badges claras
    let status: 'safe' | 'low' | 'exhausted' | 'critical' | 'unregistered' = 'safe';
    let statusLabel = 'Em Nível Seguro';
    let statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';

    if (initialStockSheets === 0 && totalFactorySheets === 0) {
      status = 'unregistered';
      statusLabel = 'Sem Cadastro Inicial';
      statusBadgeClass = 'bg-slate-100 text-slate-700 border-slate-300';
    } else if (saldoAtualSheets < 0) {
      status = 'critical';
      statusLabel = 'Estoque Crítico / Negativo';
      statusBadgeClass = 'bg-red-100 text-red-800 border-red-300 animate-pulse';
    } else if (saldoAtualSheets === 0 && totalFactorySheets > 0) {
      status = 'exhausted';
      statusLabel = 'Estoque Esgotado';
      statusBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    } else if (saldoAtualSheets > 0 && saldoAtualSheets < pkgSheets) {
      status = 'low';
      statusLabel = 'Nível Baixo (< 1 pct)';
      statusBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    }

    return {
      isAll: false,
      paperName,
      paperCode,
      packageSheets: pkgSheets,
      totalOrders,
      totalLiquidSheets,
      totalBreakMargin,
      totalFactorySheets,
      totalFinalSheets,
      totalPackagesApprox,
      initialStockSheets,
      saldoAtualSheets,
      saldoPackages,
      status,
      statusLabel,
      statusBadgeClass,
    };
  }, [
    selectedPaperFilter,
    paperFilteredOrders,
    selectedPaperObject,
    paperConsumptionGroup,
    estoqueBaseMap,
  ]);

  // Carga e distribuição por máquina de impressão
  const machineDistribution = useMemo(() => {
    if (filteredOrders.length === 0) return [];
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
      'Estoque Inicial (fls)',
      'Total O.S.',
      'Folhas Finais Produzidas',
      'Folhas Líquidas',
      'Sobra (Acerto) (fls)',
      'SOMA EXATA DE FOLHAS GASTAS',
      'SALDO ATUAL EM ESTOQUE (fls)',
      'SITUAÇÃO DO SALDO',
    ];

    const currentFilterLabel =
      selectedMonth === 'TODOS' ? 'Todos os Meses' : canonicalizeMonthDisplay(selectedMonth);

    const rows = paperConsumptionGroup.map((g) => {
      const statusText =
        g.saldoAtualSheets < 0
          ? 'ALERTA: Saldo Negativo'
          : g.saldoAtualSheets === 0 && g.initialStockSheets === 0
          ? 'Não cadastrado'
          : 'Estoque Regular';

      return [
        `"${currentFilterLabel}"`,
        `"${g.paperName}"`,
        `"${g.paperCode}"`,
        `"${g.widthMm}x${g.heightMm}"`,
        g.packageSheets,
        g.initialStockSheets,
        g.ordersCount,
        g.totalFinalSheets,
        g.fullSheetsNeeded,
        g.breakMarginTotal,
        g.totalFactorySheetsUsed,
        g.saldoAtualSheets,
        `"${statusText}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeName = selectedMonth === 'TODOS' ? 'geral' : selectedMonth.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `relatorio_balanco_estoque_pjerj_${safeName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 max-w-[100vw] py-6 space-y-6">
      {/* Top Banner do Diretor com Sub-Navegação */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
              Diretoria de Administração &bull; PJERJ
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Tempo Real: {allManualOrders.length} O.S. Manuais dos Operadores</span>
            </div>
            {rawOrders.length > allManualOrders.length && (
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {rawOrders.length - allManualOrders.length} registros SISMAT ocultos
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-1.5">
            <LayoutDashboard className="w-5 h-5 text-emerald-600" />
            <span>Dashboard do Diretor: Estoque & Consumo Gráfico</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Motor de balanço e inventário com baixa automática a partir das ordens de serviço ativas.
          </p>
        </div>

        {/* Botões de Ação Superior & Seletor de Sub-Aba */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternância de Abas: Visão Geral vs Balanço / Cadastro */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveSubTab('visao_geral')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'visao_geral'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Consumo Consolidado</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('balanco_estoque')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'balanco_estoque'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span>Balanço / Cadastro de Estoque</span>
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs transition-colors border border-slate-300 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* SEÇÃO 1: ABA DE BALANÇO / CADASTRO DE ESTOQUE BASE */}
      {activeSubTab === 'balanco_estoque' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <Warehouse className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cadastro Base de Estoque (Balanço Inicial de Papel)
                </h3>
                <p className="text-xs text-slate-500">
                  Insira o estoque inicial físico no almoxarifado gráfico (em pacotes ou folhas). Os dados são gravados permanentemente na coleção <code>&apos;estoque_base&apos;</code> do Firebase.
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 text-blue-900 px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>O Saldo Atual é deduzido em tempo real sempre que novas O.S. forem emitidas.</span>
            </div>
          </div>

          {/* Tabela de Cadastro de Estoque Inicial */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-3 px-3">Tipo de Papel (Estoque)</th>
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Formato de Fábrica</th>
                  <th className="py-3 px-3 text-center">Fls / Pacote</th>
                  <th className="py-3 px-4 text-center bg-blue-50 text-blue-950 font-black">
                    ESTOQUE INICIAL (PACOTES)
                  </th>
                  <th className="py-3 px-4 text-center bg-emerald-50 text-emerald-950 font-black">
                    ESTOQUE INICIAL (TOTAL FOLHAS)
                  </th>
                  <th className="py-3 px-3 text-right">Consumo Acumulado</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {papers.map((p) => {
                  const baseInfo = estoqueBaseMap[p.id] || estoqueBaseMap[p.name];
                  const currentInitialSheets = baseInfo ? baseInfo.initialSheets : 0;
                  const currentInitialPackages = Math.floor(currentInitialSheets / (p.packageSheets || 250));

                  // Consumo já ocorrido deste papel
                  const consumptionItem = paperConsumptionGroup.find(
                    (g) => g.paperId === p.id || g.paperName.toLowerCase() === p.name.toLowerCase()
                  );
                  const totalSpent = consumptionItem ? consumptionItem.totalFactorySheetsUsed : 0;

                  return (
                    <StockRowEditor
                      key={p.id}
                      paper={p}
                      initialSheets={currentInitialSheets}
                      initialPackages={currentInitialPackages}
                      totalSpent={totalSpent}
                      isSaving={savingStockId === p.id}
                      isSuccess={saveSuccessStockId === p.id}
                      onSave={(sheets, mode) =>
                        handleSaveEstoqueBase(
                          p.id,
                          p.name,
                          p.code,
                          p.packageSheets,
                          sheets,
                          mode
                        )
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              Todos os Meses ({allManualOrders.length} O.S.)
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

            {/* Atalhos Rápidos */}
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
            ({filteredOrders.length} O.S. computadas do operador)
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <RefreshCw className="w-3 h-3 text-emerald-600" />
            Sincronizado: {lastSyncTime.toLocaleTimeString('pt-BR')}
          </span>
        </div>
      </div>

      {/* 1. SELETOR REATIVO DE PAPEL PARA AUDITORIA DE ESTOQUE (BI) */}
      <div className="bg-white border-2 border-slate-200 hover:border-emerald-500/50 transition-colors rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Package className="w-5 h-5 text-emerald-600 stroke-[2.2]" />
            </div>
            <div>
              <label
                htmlFor="paper-audit-selector"
                className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 cursor-pointer"
              >
                <span>📦 Escolha o Papel para Auditoria de Estoque:</span>
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selectedPaperFilter === 'all'
                  ? 'Visualização Consolidada: Indicadores acumulados de todos os tipos de papéis da gráfica.'
                  : `Auditoria Focada: Isolamento matemático imediato de consumo e saldo para ${auditCardMetrics.paperName}.`}
              </p>
            </div>
          </div>

          {/* Dropdown Reativo de Papéis */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                id="paper-audit-selector"
                value={selectedPaperFilter}
                onChange={(e) => setSelectedPaperFilter(e.target.value)}
                className="bg-emerald-50/60 border-2 border-emerald-600/40 hover:border-emerald-600 text-slate-900 font-bold rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all shadow-xs cursor-pointer min-w-[280px]"
              >
                <option value="all">Visualizar Todos os Papéis</option>
                {availablePapersList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.code ? `[${p.code}]` : ''} ({p.packageSheets || 250} fls/pct)
                  </option>
                ))}
              </select>
            </div>

            {selectedPaperFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedPaperFilter('all')}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Redefinir para visualizar todos os papéis"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
                <span>Ver Todos os Papéis</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Status e Auditoria Ativa */}
        <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-slate-100 text-xs gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 text-[11px]">Papel Auditado:</span>
            <span className="font-bold text-slate-900 px-2.5 py-0.5 bg-slate-100 rounded-md text-[11px] border border-slate-200">
              {auditCardMetrics.paperName}
            </span>
            {auditCardMetrics.paperCode && (
              <span className="font-mono text-[10px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                Código: {auditCardMetrics.paperCode}
              </span>
            )}
            <span className="text-[10px] font-semibold text-slate-400">
              ({auditCardMetrics.packageSheets} folhas / pacote)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              {selectedPaperFilter === 'all'
                ? `${auditCardMetrics.totalOrders} O.S. ativas no período`
                : `${auditCardMetrics.totalOrders} O.S. exclusivas deste papel`}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${auditCardMetrics.statusBadgeClass}`}
            >
              {auditCardMetrics.statusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 2. OS 4 CARDS REATIVOS DE BUSINESS INTELLIGENCE (BI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: GASTO TOTAL DE FOLHAS */}
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-teal-950 text-white p-5 rounded-2xl shadow-md border border-emerald-700/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-emerald-300 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Gasto Total de Folhas</span>
              </span>
              <span className="text-[10px] font-bold bg-emerald-800/80 text-emerald-200 px-2 py-0.5 rounded-md border border-emerald-600/50">
                {auditCardMetrics.totalOrders} O.S.
              </span>
            </div>
            <div className="text-3xl font-black font-mono tracking-tight text-white mt-1">
              {auditCardMetrics.totalFactorySheets.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs font-semibold text-emerald-300/90 mt-0.5">
              folhas inteiras de fábrica
            </div>
          </div>
          <div className="text-[11px] text-emerald-200/75 pt-3 mt-3 border-t border-emerald-800/60 truncate">
            {selectedPaperFilter === 'all'
              ? 'Consumo acumulado (todos os papéis)'
              : `Consumo restrito a: ${auditCardMetrics.paperName}`}
          </div>
        </div>

        {/* CARD 2: FOLHAS LÍQUIDAS */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between hover:border-blue-400 transition-colors">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-blue-950">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Folhas Líquidas</span>
              </span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                {auditCardMetrics.totalFactorySheets > 0
                  ? `${Math.round(
                      (auditCardMetrics.totalLiquidSheets / auditCardMetrics.totalFactorySheets) * 100
                    )}% útil`
                  : '100% útil'}
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-slate-900 mt-1">
              {auditCardMetrics.totalLiquidSheets.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              folhas absorvidas no produto
            </div>
          </div>
          <div className="text-[11px] text-slate-500 pt-3 mt-3 border-t border-slate-100 truncate">
            {auditCardMetrics.totalFinalSheets > 0
              ? `Rendimento cortado: ${auditCardMetrics.totalFinalSheets.toLocaleString('pt-BR')} fls`
              : 'Volume líquido impresso nas O.S.'}
          </div>
        </div>

        {/* CARD 3: SOBRA (ACERTO) */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between hover:border-amber-400 transition-colors">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-amber-950">
                <Radio className="w-4 h-4 text-amber-600" />
                <span>Sobra (Acerto)</span>
              </span>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                {auditCardMetrics.totalFactorySheets > 0
                  ? `${Math.round(
                      (auditCardMetrics.totalBreakMargin / auditCardMetrics.totalFactorySheets) * 100
                    )}% margem`
                  : '0% margem'}
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-amber-900 mt-1">
              +{auditCardMetrics.totalBreakMargin.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs font-semibold text-amber-700 mt-0.5">
              folhas de margem técnica
            </div>
          </div>
          <div className="text-[11px] text-slate-500 pt-3 mt-3 border-t border-slate-100">
            Margem técnica de ajuste e máquina
          </div>
        </div>

        {/* CARD 4: SALDO ATUALIZADO EM ESTOQUE / PACOTES */}
        <div
          className={`p-5 rounded-2xl shadow-xs border flex flex-col justify-between transition-colors ${
            selectedPaperFilter !== 'all' && auditCardMetrics.saldoAtualSheets < 0
              ? 'bg-red-50/70 border-red-300'
              : 'bg-white border-slate-200 hover:border-emerald-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-800">
                <Package className="w-4 h-4 text-purple-600" />
                <span>
                  {selectedPaperFilter !== 'all' ? 'Saldo Real em Estoque' : 'Pacotes & Saldo'}
                </span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${auditCardMetrics.statusBadgeClass}`}
              >
                {auditCardMetrics.statusLabel}
              </span>
            </div>

            {selectedPaperFilter !== 'all' ? (
              <>
                <div
                  className={`text-3xl font-black font-mono tracking-tight mt-1 ${
                    auditCardMetrics.saldoAtualSheets < 0
                      ? 'text-red-700'
                      : auditCardMetrics.saldoAtualSheets === 0 && auditCardMetrics.initialStockSheets === 0
                      ? 'text-slate-600'
                      : 'text-emerald-900'
                  }`}
                >
                  {auditCardMetrics.saldoAtualSheets.toLocaleString('pt-BR')}
                </div>
                <div className="text-xs font-semibold text-slate-600 mt-0.5">
                  folhas físicas restantes
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-black font-mono text-slate-900 mt-1">
                  ~ {auditCardMetrics.totalPackagesApprox} pct
                </div>
                <div className="text-xs font-semibold text-slate-500 mt-0.5">
                  volumes fechados consumidos
                </div>
              </>
            )}
          </div>

          <div className="text-[11px] text-slate-600 pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
            {selectedPaperFilter !== 'all' ? (
              <>
                <span>
                  Inicial: <strong>{auditCardMetrics.initialStockSheets.toLocaleString('pt-BR')}</strong> fls
                </span>
                <span className="font-semibold text-slate-500">
                  ~ {auditCardMetrics.saldoPackages} pct
                </span>
              </>
            ) : (
              <>
                <span>
                  Saldo Geral: <strong>{auditCardMetrics.saldoAtualSheets.toLocaleString('pt-BR')}</strong> fls
                </span>
                <span className="font-semibold text-purple-700">
                  {paperConsumptionGroup.length} papéis
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* TABELA CONSOLIDADA: MOTOR DE ABAIXO DE ESTOQUE EM TEMPO REAL */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-emerald-600" />
              <span>Consumo Consolidado & Balanço de Estoque em Tempo Real</span>
            </h3>
            <p className="text-xs text-slate-500">
              Três colunas de auditoria: <strong>Quantidade Inicial em Estoque</strong>, <strong>Total de Folhas Gastas</strong> e <strong>Saldo Atual em Estoque</strong> (com alerta se negativo).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('balanco_estoque')}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Ajustar Estoque Inicial</span>
            </button>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              {paperConsumptionGroup.length} Papéis Listados
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase text-[10px]">
                <th className="py-3 px-3">Papel (Estoque)</th>
                <th className="py-3 px-3">Formato</th>
                <th className="py-3 px-3 text-center">Pacote</th>
                <th className="py-3 px-3 text-center">Nº O.S.</th>
                <th className="py-3 px-3 text-right">Folhas Líquidas</th>
                <th className="py-3 px-3 text-right">Sobra</th>
                
                {/* 3 COLUNAS MATEMÁTICAS CRUCIAIS DE ESTOQUE */}
                <th className="py-3 px-3 text-right bg-blue-50 text-blue-950 font-black border-l border-blue-200">
                  QUANTIDADE INICIAL EM ESTOQUE
                </th>
                <th className="py-3 px-3 text-right bg-emerald-50 text-emerald-950 font-black border-l border-emerald-200">
                  TOTAL DE FOLHAS GASTAS
                </th>
                <th className="py-3 px-4 text-center bg-slate-100 text-slate-900 font-black border-l border-slate-300">
                  SALDO ATUAL EM ESTOQUE
                </th>
                <th className="py-3 px-3 text-center">PACOTES GASTOS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paperConsumptionGroup.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                        <Boxes className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-600 text-sm">
                        Nenhum consumo de papel registrado para o filtro selecionado.
                      </p>
                      <p className="text-xs text-slate-400">
                        O histórico SISMAT foi ignorado. Crie uma nova Ordem de Serviço na tela do operador para visualizar os números sendo calculados em tempo real.
                      </p>
                    </div>
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

                  const isNegativeSaldo = group.saldoAtualSheets < 0;
                  const saldoPackages = Math.floor(group.saldoAtualSheets / (group.packageSheets || 250));
                  const saldoRemainder = group.saldoAtualSheets % (group.packageSheets || 250);

                  const isAuditedRow =
                    selectedPaperFilter !== 'all' &&
                    (group.paperId === selectedPaperFilter ||
                      (selectedPaperObject &&
                        (group.paperName?.toLowerCase() === selectedPaperObject.name.toLowerCase() ||
                          (selectedPaperObject.code && group.paperCode === selectedPaperObject.code))));

                  return (
                    <tr
                      key={group.paperName}
                      className={`transition-colors ${
                        isAuditedRow
                          ? 'bg-emerald-50/90 ring-2 ring-emerald-500 font-medium shadow-xs'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-slate-900">{group.paperName}</strong>
                          {isAuditedRow && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-700 text-white shadow-xs">
                              🎯 Foco da Auditoria
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {group.paperCode || 'S/ Código'} &bull; O.S.: {group.ordersList.length > 0 ? group.ordersList.join(', ') : 'Nenhuma'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {group.widthMm} × {group.heightMm} mm
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                        {group.packageSheets} fls
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

                      {/* 1. QUANTIDADE INICIAL EM ESTOQUE */}
                      <td className="py-3 px-3 text-right bg-blue-50/50 border-l border-blue-200">
                        <span className="font-mono font-bold text-blue-950 block text-xs">
                          {group.initialStockSheets.toLocaleString('pt-BR')} fls
                        </span>
                        <span className="text-[10px] text-blue-700 font-medium">
                          ({Math.floor(group.initialStockSheets / group.packageSheets)} pct)
                        </span>
                      </td>

                      {/* 2. TOTAL DE FOLHAS GASTAS */}
                      <td className="py-3 px-3 text-right bg-emerald-50/70 border-l border-emerald-200">
                        <span className="text-xs font-black font-mono text-emerald-950 block">
                          {group.totalFactorySheetsUsed.toLocaleString('pt-BR')} fls
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          GASTO TOTAL
                        </span>
                      </td>

                      {/* 3. SALDO ATUAL EM ESTOQUE (COM ALERTA CONDICIONAL SE NEGATIVO) */}
                      <td
                        className={`py-3 px-4 text-center border-l ${
                          isNegativeSaldo
                            ? 'bg-red-50 border-red-300 text-red-950 animate-pulse'
                            : 'bg-emerald-50/40 border-slate-200 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {isNegativeSaldo && (
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          )}
                          <span
                            className={`text-sm font-black font-mono tracking-tight ${
                              isNegativeSaldo ? 'text-red-700' : 'text-emerald-950'
                            }`}
                          >
                            {group.saldoAtualSheets.toLocaleString('pt-BR')} fls
                          </span>
                        </div>
                        {isNegativeSaldo ? (
                          <span className="text-[10px] font-bold text-red-700 uppercase tracking-tight block">
                            ESTOQUE NEGATIVO (REQUISIÇÃO URGENTE)
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium block">
                            ~ {saldoPackages} pct + {saldoRemainder} fls
                          </span>
                        )}
                      </td>

                      {/* PACOTES INTEIROS GASTOS */}
                      <td className="py-3 px-3 text-center">
                        <div className="font-mono font-bold text-slate-800 text-xs">
                          {totalPackagesCeil} pct
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ({fullPackages} fch + {remainderSheets} fls)
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
                  <td className="py-3 px-3 text-right font-mono text-blue-200">
                    {metrics.totalInitialStockSheets.toLocaleString('pt-BR')} fls
                  </td>
                  <td className="py-3 px-3 text-right bg-emerald-950 text-emerald-300 font-black text-sm font-mono">
                    {metrics.totalFactorySheets.toLocaleString('pt-BR')} FL. INT.
                  </td>
                  <td
                    className={`py-3 px-4 text-center font-black text-sm font-mono ${
                      metrics.totalSaldoSheets < 0 ? 'bg-red-900 text-red-100' : 'bg-slate-800 text-white'
                    }`}
                  >
                    {metrics.totalSaldoSheets.toLocaleString('pt-BR')} FLS RESTANTES
                  </td>
                  <td className="py-3 px-3 text-center bg-amber-950 text-amber-300 font-black text-xs font-mono">
                    ~ {metrics.totalPackagesApprox} PCTS
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
          <Layers className="w-5 h-5 text-purple-600" />
          <span>Utilização e Consumo por Máquina de Impressão</span>
        </h3>

        {machineDistribution.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">Nenhuma máquina utilizada até o momento nas O.S. ativas.</p>
        ) : (
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
        )}
      </div>
    </div>
  );
};

// Componente Editor de Linha para o Estoque Base
interface StockRowEditorProps {
  paper: {
    id: string;
    name: string;
    code: string;
    widthMm: number;
    heightMm: number;
    packageSheets: number;
  };
  initialSheets: number;
  initialPackages: number;
  totalSpent: number;
  isSaving: boolean;
  isSuccess: boolean;
  onSave: (val: number, mode: 'sheets' | 'packages') => void;
}

const StockRowEditor: React.FC<StockRowEditorProps> = ({
  paper,
  initialSheets,
  initialPackages,
  totalSpent,
  isSaving,
  isSuccess,
  onSave,
}) => {
  const [packagesInput, setPackagesInput] = useState<string>(
    initialPackages > 0 ? String(initialPackages) : ''
  );
  const [sheetsInput, setSheetsInput] = useState<string>(
    initialSheets > 0 ? String(initialSheets) : ''
  );
  const [mode, setMode] = useState<'packages' | 'sheets'>('packages');

  useEffect(() => {
    setPackagesInput(initialPackages > 0 ? String(initialPackages) : '');
    setSheetsInput(initialSheets > 0 ? String(initialSheets) : '');
  }, [initialSheets, initialPackages]);

  const handlePackagesChange = (val: string) => {
    setPackagesInput(val);
    setMode('packages');
    const num = Number(val) || 0;
    setSheetsInput(String(num * (paper.packageSheets || 250)));
  };

  const handleSheetsChange = (val: string) => {
    setSheetsInput(val);
    setMode('sheets');
    const num = Number(val) || 0;
    setPackagesInput(String(Math.floor(num / (paper.packageSheets || 250))));
  };

  const handleSave = () => {
    if (mode === 'packages') {
      onSave(Number(packagesInput) || 0, 'packages');
    } else {
      onSave(Number(sheetsInput) || 0, 'sheets');
    }
  };

  const saldo = initialSheets - totalSpent;

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="py-3 px-3">
        <strong className="text-slate-900 block">{paper.name}</strong>
      </td>
      <td className="py-3 px-3 font-mono text-slate-500">{paper.code || 'S/C'}</td>
      <td className="py-3 px-3 font-mono text-slate-600">
        {paper.widthMm} × {paper.heightMm} mm
      </td>
      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
        {paper.packageSheets} fls/pct
      </td>

      {/* Input de Pacotes */}
      <td className="py-3 px-4 text-center bg-blue-50/40">
        <div className="flex items-center justify-center gap-1.5">
          <input
            type="number"
            min="0"
            value={packagesInput}
            onChange={(e) => handlePackagesChange(e.target.value)}
            placeholder="0"
            className="w-20 px-2 py-1 bg-white border border-blue-300 rounded-lg text-center font-mono font-bold text-xs text-blue-950 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
          <span className="text-[10px] text-blue-700 font-semibold">pct</span>
        </div>
      </td>

      {/* Input de Folhas Totais */}
      <td className="py-3 px-4 text-center bg-emerald-50/40">
        <div className="flex items-center justify-center gap-1.5">
          <input
            type="number"
            min="0"
            value={sheetsInput}
            onChange={(e) => handleSheetsChange(e.target.value)}
            placeholder="0"
            className="w-24 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-center font-mono font-bold text-xs text-emerald-950 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
          <span className="text-[10px] text-emerald-700 font-semibold">fls</span>
        </div>
      </td>

      {/* Consumo Acumulado */}
      <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
        {totalSpent > 0 ? (
          <span className="text-emerald-700">-{totalSpent.toLocaleString('pt-BR')} fls</span>
        ) : (
          <span className="text-slate-400">0</span>
        )}
      </td>

      {/* Botão de Salvar no Firebase */}
      <td className="py-3 px-3 text-center">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            isSuccess
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs cursor-pointer active:scale-95'
          }`}
        >
          {isSaving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : isSuccess ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Salvo!</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Salvar</span>
            </>
          )}
        </button>
      </td>
    </tr>
  );
};

export default DirectorDashboard;
