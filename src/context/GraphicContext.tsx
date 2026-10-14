import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  PaperFactory,
  CutFormat,
  ServiceCatalog,
  Responsible,
  Machine,
  ServiceOrder,
  OrderStatus,
} from '../types';
import {
  INITIAL_PAPERS,
  INITIAL_FORMATS,
  INITIAL_SERVICES,
  INITIAL_RESPONSIBLES,
  INITIAL_MACHINES,
  createInitialOrders,
} from '../data/initialData.ts';
import { calculateOrderMath } from '../utils/graphicMath';
import { db, isFirebaseConfigured } from '../firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { carregarHistoricoSismat } from '../utils/importadorSismat';

interface GraphicContextType {
  orders: ServiceOrder[];
  papers: PaperFactory[];
  formats: CutFormat[];
  services: ServiceCatalog[];
  responsibles: Responsible[];
  machines: Machine[];
  selectedOrderForPrint: ServiceOrder | null;
  setSelectedOrderForPrint: (order: ServiceOrder | null) => void;
  isFirebaseActive: boolean;
  sismatImportedCount: number;
  reimportarSismat: () => Promise<void>;

  // Order Actions
  loadOlderOrdersFromFirestore: () => Promise<number>;
  isFetchingOlderOrders: boolean;
  hasLoadedAllOrders: boolean;
  addOrder: (
    data: Omit<
      ServiceOrder,
      | 'id'
      | 'orderNumber'
      | 'createdAt'
      | 'updatedAt'
      | 'totalFinalSheets'
      | 'yieldPerSheet'
      | 'cutsDescription'
      | 'fullSheetsNeeded'
      | 'totalFactorySheetsUsed'
      | 'packagesCount'
      | 'efficiencyPercent'
    > & { id?: string; orderNumber?: string }
  ) => Promise<ServiceOrder>;
  updateOrder: (id: string, data: Partial<ServiceOrder>) => Promise<ServiceOrder | undefined>;
  handleUpdateOrder: (id: string, data: Partial<ServiceOrder>) => Promise<ServiceOrder | undefined>;
  editOrder: (id: string, data: Partial<ServiceOrder>) => Promise<ServiceOrder | undefined>;
  deleteOrder: (id: string) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  getNextOrderNumber: () => string;

  // Paper Actions
  addPaper: (paper: Omit<PaperFactory, 'id'>) => void;
  updatePaper: (id: string, paper: Partial<PaperFactory>) => void;
  deletePaper: (id: string) => void;

  // Format Actions
  addFormat: (format: Omit<CutFormat, 'id'>) => void;
  updateFormat: (id: string, format: Partial<CutFormat>) => void;
  deleteFormat: (id: string) => void;

  // Service Actions
  addService: (service: Omit<ServiceCatalog, 'id'>) => void;
  updateService: (id: string, service: Partial<ServiceCatalog>) => void;
  deleteService: (id: string) => void;

  // Responsibles & Machines
  addResponsible: (name: string, role?: string) => void;
  updateResponsible: (id: string, name: string, role?: string) => void;
  deleteResponsible: (id: string) => void;
  addMachine: (name: string, tech?: string) => void;
  deleteMachine: (id: string) => void;

  // Database tools
  resetDatabaseToDefault: () => void;
}

const GraphicContext = createContext<GraphicContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ORDERS: 'pjerj_digra_orders_v7',
  PAPERS: 'pjerj_digra_papers_v7',
  FORMATS: 'pjerj_digra_formats_v7',
  SERVICES: 'pjerj_digra_services_v7',
  RESPONSIBLES: 'pjerj_digra_responsibles_v7',
  MACHINES: 'pjerj_digra_machines_v7',
};

const SYNC_CHANNEL = 'pjerj_digra_sync_channel_v7';

/**
 * Normaliza o código do serviço para chave única (ignora traços, pontos, barras e espaços)
 */
function normalizeServiceCodeKey(code: string): string {
  if (!code) return '';
  return code.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
}

/**
 * Mescla serviços garantindo que a base de INITIAL_SERVICES (os 1.449 materiais de fichas_tecnicas.json)
 * seja SEMPRE preservada na íntegra.
 * Começa sempre com INITIAL_SERVICES e aplica por cima os documentos do Firestore ou do cache,
 * usando o código normalizado como chave.
 * Quando o mesmo código existir nos dois, o do Firestore/override tem prioridade.
 */
export function mergeWithInitialServices(overrideServices?: ServiceCatalog[] | null): ServiceCatalog[] {
  const map = new Map<string, ServiceCatalog>();

  // 1. Sempre inicia com TODOS os materiais de INITIAL_SERVICES (1.449 materiais)
  for (const s of INITIAL_SERVICES) {
    const codeVal = s.code || (s as any).codigo || '';
    const key = normalizeServiceCodeKey(codeVal);
    if (key) {
      map.set(key, s);
    }
  }

  // 2. Aplica por cima os documentos do Firestore / cache (prioridade para o override)
  if (Array.isArray(overrideServices)) {
    for (const s of overrideServices) {
      if (!s) continue;
      const codeVal = s.code || (s as any).codigo || '';
      const key = normalizeServiceCodeKey(codeVal);
      if (key) {
        const existing = map.get(key);
        if (existing) {
          // Quando o mesmo código existir nos dois, o do Firestore/override tem prioridade
          map.set(key, { ...existing, ...s });
        } else {
          map.set(key, s);
        }
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Constrói o documento espelho para a coleção centralizada 'dashboard_metrics' no Firestore.
 * Contém os dados consolidados de consumo físico de papel da O.S. usando o mesmo ID.
 */
export function buildDashboardMetricFromOrder(order: ServiceOrder) {
  return {
    id: order.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    bsNumber: order.bsNumber || '',
    materialCode: order.serviceCode || '',
    serviceCode: order.serviceCode || '',
    serviceName: order.serviceName || '',
    serviceCategory: order.serviceCategory || '',
    productionMonth: order.productionMonth || '',
    dateEmission: order.dateEmission || order.productionMonth || '',
    paperId: order.paperId || '',
    paperCode: order.paperCode || '',
    paperName: order.paperName || '',
    packageSheets: order.packageSheets || 250,
    cutFormatId: order.cutFormatId || '',
    cutFormatName: order.cutFormatName || '',
    liquidSheets: order.fullSheetsNeeded || 0,
    fullSheetsNeeded: order.fullSheetsNeeded || 0,
    surplusSheets: order.surplusSheets !== undefined ? order.surplusSheets : (order.breakMargin || 0),
    surplusPercent: order.surplusPercent !== undefined ? order.surplusPercent : 10,
    totalFactorySheetsUsed: order.totalFactorySheetsUsed || 0,
    totalFinalSheets: order.totalFinalSheets || 0,
    totalPrintedSheets: order.totalPrintedSheets || 0,
    blocksQty: order.blocksQty || 0,
    sheetsPerBlock: order.sheetsPerBlock || 100,
    ways: order.ways || 1,
    materialType: order.materialType || 'BLOCO',
    status: order.status || 'Pronto',
    machine: order.machine || '',
    createdBy: order.createdBy || '',
    updatedAt: order.updatedAt || Date.now(),
    createdAt: order.createdAt || Date.now(),
  };
}

export const GraphicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [responsibles, setResponsibles] = useState<Responsible[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RESPONSIBLES);
      return saved ? JSON.parse(saved) : INITIAL_RESPONSIBLES;
    } catch {
      return INITIAL_RESPONSIBLES;
    }
  });

  const [machines, setMachines] = useState<Machine[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MACHINES);
      return saved ? JSON.parse(saved) : INITIAL_MACHINES;
    } catch {
      return INITIAL_MACHINES;
    }
  });

  const [papers, setPapers] = useState<PaperFactory[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PAPERS);
      return saved ? JSON.parse(saved) : INITIAL_PAPERS;
    } catch {
      return INITIAL_PAPERS;
    }
  });

  const [formats, setFormats] = useState<CutFormat[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FORMATS);
      return saved ? JSON.parse(saved) : INITIAL_FORMATS;
    } catch {
      return INITIAL_FORMATS;
    }
  });

  const [services, setServices] = useState<ServiceCatalog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SERVICES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Garante que o cache do localStorage nunca reduza a lista abaixo de INITIAL_SERVICES (1.449 materiais)
          return mergeWithInitialServices(parsed);
        }
      }
      return INITIAL_SERVICES;
    } catch {
      return INITIAL_SERVICES;
    }
  });

  const [orders, setOrders] = useState<ServiceOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return saved ? JSON.parse(saved) : createInitialOrders();
    } catch {
      return createInitialOrders();
    }
  });

  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<ServiceOrder | null>(null);
  const [sismatImportedCount, setSismatImportedCount] = useState<number>(0);
  const [isFirebaseActive, setIsFirebaseActive] = useState<boolean>(isFirebaseConfigured);
  const [isFetchingOlderOrders, setIsFetchingOlderOrders] = useState<boolean>(false);
  const [hasLoadedAllOrders, setHasLoadedAllOrders] = useState<boolean>(false);

  // Busca ordens mais antigas no Firestore sob demanda (apenas quando solicitado na busca do histórico)
  const loadOlderOrdersFromFirestore = useCallback(async (): Promise<number> => {
    if (!isFirebaseConfigured || !db || isFetchingOlderOrders) return 0;
    setIsFetchingOlderOrders(true);
    try {
      const snap = await getDocs(collection(db, 'orders'));
      if (!snap.empty) {
        const allRemoteOrders = snap.docs.map((d) => d.data() as ServiceOrder);
        let addedCount = 0;
        setOrders((prev) => {
          const map = new Map<string, ServiceOrder>();
          for (const ord of prev) {
            if (ord.id) map.set(ord.id, ord);
          }
          for (const ord of allRemoteOrders) {
            if (ord.id && !map.has(ord.id)) {
              addedCount++;
              map.set(ord.id, ord);
            } else if (ord.id) {
              map.set(ord.id, ord);
            }
          }
          return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        });
        setHasLoadedAllOrders(true);
        return addedCount;
      }
      setHasLoadedAllOrders(true);
      return 0;
    } catch (err) {
      console.warn('[PJERJ DIGRA] Erro ao carregar histórico antigo do Firestore:', err);
      return 0;
    } finally {
      setIsFetchingOlderOrders(false);
    }
  }, [isFetchingOlderOrders]);

  // Inicialização única do Histórico SISMAT (injeta no estado local e salva no Firestore)
  useEffect(() => {
    let isMounted = true;

    async function initSismat() {
      try {
        const res = await carregarHistoricoSismat();
        if (isMounted && res.success) {
          setSismatImportedCount(res.totalImported);
          if (res.totalImported > 0) {
            setOrders(res.orders);
            setServices(mergeWithInitialServices(res.services));
            setFormats(res.formats);
            setPapers(res.papers);
          }
        }
      } catch (err) {
        console.error('[PJERJ DIGRA] Erro ao carregar histórico SISMAT:', err);
      }
    }

    initSismat();

    return () => {
      isMounted = false;
    };
  }, []);

  // Persistence to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PAPERS, JSON.stringify(papers));
  }, [papers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FORMATS, JSON.stringify(formats));
  }, [formats]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RESPONSIBLES, JSON.stringify(responsibles));
  }, [responsibles]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(machines));
  }, [machines]);

  // Firestore real-time synchronization if configured
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    let unsubOrders: (() => void) | undefined;
    let unsubPapers: (() => void) | undefined;
    let unsubFormats: (() => void) | undefined;
    let unsubServices: (() => void) | undefined;
    let unsubResponsibles: (() => void) | undefined;
    let unsubMachines: (() => void) | undefined;

    const handleListenerError = (collectionName: string) => (err: any) => {
      console.warn(
        `[PJERJ DIGRA] Firestore '${collectionName}' operando em modo local seguro. (Status: ${err?.code || 'permissão restrita'})`
      );
      setIsFirebaseActive(false);
    };

    try {
      // Otimização de Leituras: Listener carrega apenas as O.S. mais recentes (últimas 500 por createdAt desc)
      // evitando baixar milhares de documentos antigos em tempo real continuamente.
      const qOrders = query(
        collection(db, 'orders'),
        orderBy('createdAt', 'desc'),
        limit(500)
      );

      unsubOrders = onSnapshot(
        qOrders,
        (snapshot) => {
          const remoteOrders = snapshot.docs.map((d) => {
            const data = d.data() as ServiceOrder;
            return {
              ...data,
              id: d.id || data.id,
            };
          });

          setOrders((prev) => {
            const combinedMap = new Map<string, ServiceOrder>();

            // 1. Ordens remotas oficiais do Firestore têm prioridade máxima
            for (const ord of remoteOrders) {
              if (ord.id) combinedMap.set(ord.id, ord);
            }

            // 2. Preserva apenas ordens antigas carregadas sob demanda (anteriores à mais antiga da janela remota)
            const oldestRemoteCreatedAt =
              remoteOrders.length > 0
                ? remoteOrders[remoteOrders.length - 1].createdAt || 0
                : 0;

            for (const ord of prev) {
              if (ord.id && !combinedMap.has(ord.id)) {
                if ((ord.createdAt || 0) < oldestRemoteCreatedAt) {
                  combinedMap.set(ord.id, ord);
                }
              }
            }

            return Array.from(combinedMap.values()).sort(
              (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
            );
          });
          setIsFirebaseActive(true);
        },
        handleListenerError('orders')
      );

      unsubPapers = onSnapshot(
        collection(db, 'papers'),
        (snapshot) => {
          if (!snapshot.empty) {
            setPapers(snapshot.docs.map((d) => d.data() as PaperFactory));
          }
        },
        handleListenerError('papers')
      );

      unsubFormats = onSnapshot(
        collection(db, 'formats'),
        (snapshot) => {
          if (!snapshot.empty) {
            setFormats(snapshot.docs.map((d) => d.data() as CutFormat));
          }
        },
        handleListenerError('formats')
      );

      unsubServices = onSnapshot(
        collection(db, 'services'),
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteServices = snapshot.docs.map((d) => d.data() as ServiceCatalog);
            // MESCLAR: Inicia com INITIAL_SERVICES (os 1.449 materiais) e aplica por cima os documentos do Firestore
            setServices(mergeWithInitialServices(remoteServices));
          }
        },
        handleListenerError('services')
      );

      unsubResponsibles = onSnapshot(
        collection(db, 'responsibles'),
        (snapshot) => {
          if (!snapshot.empty) {
            setResponsibles(snapshot.docs.map((d) => d.data() as Responsible));
          }
        },
        handleListenerError('responsibles')
      );

      unsubMachines = onSnapshot(
        collection(db, 'machines'),
        (snapshot) => {
          if (!snapshot.empty) {
            setMachines(snapshot.docs.map((d) => d.data() as Machine));
          }
        },
        handleListenerError('machines')
      );
    } catch (err) {
      console.warn('Erro ao sincronizar Firestore:', err);
    }

    return () => {
      if (unsubOrders) unsubOrders();
      if (unsubPapers) unsubPapers();
      if (unsubFormats) unsubFormats();
      if (unsubServices) unsubServices();
      if (unsubResponsibles) unsubResponsibles();
      if (unsubMachines) unsubMachines();
    };
  }, []);

  // Real-time broadcast sync across tabs
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(SYNC_CHANNEL);

    bc.onmessage = (event) => {
      if (event.data?.type === 'SYNC_ORDERS') {
        setOrders(event.data.payload);
      } else if (event.data?.type === 'SYNC_ALL') {
        setOrders(event.data.orders);
        setPapers(event.data.papers);
        setFormats(event.data.formats);
        setServices(mergeWithInitialServices(event.data.services));
        setResponsibles(event.data.responsibles);
        setMachines(event.data.machines);
      }
    };

    return () => {
      bc.close();
    };
  }, []);

  const broadcastUpdate = useCallback((type: string, payload: unknown) => {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel(SYNC_CHANNEL);
        bc.postMessage({ type, payload });
        bc.close();
      } catch (err) {
        console.error('BroadcastChannel error:', err);
      }
    }
  }, []);

  // Forçar recarga manual do histórico SISMAT
  const reimportarSismat = useCallback(async () => {
    try {
      const res = await carregarHistoricoSismat({ force: true });
      if (res.success) {
        const mergedServices = mergeWithInitialServices(res.services);
        setSismatImportedCount(res.totalImported);
        setOrders(res.orders);
        setServices(mergedServices);
        setFormats(res.formats);
        setPapers(res.papers);
        broadcastUpdate('SYNC_ALL', {
          orders: res.orders,
          papers: res.papers,
          formats: res.formats,
          services: mergedServices,
          responsibles,
          machines,
        });
      }
    } catch (err) {
      console.error('[PJERJ DIGRA] Erro ao reimportar SISMAT:', err);
    }
  }, [broadcastUpdate, responsibles, machines]);

  // Compute next order number sequential #YYYY-XXXX
  const getNextOrderNumber = useCallback((): string => {
    const currentYear = new Date().getFullYear();
    const prefix = `#${currentYear}-`;

    const numbers = orders
      .filter((o) => o.orderNumber && o.orderNumber.startsWith(prefix))
      .map((o) => {
        const seqPart = o.orderNumber.replace(prefix, '');
        const num = parseInt(seqPart, 10);
        return isNaN(num) ? 0 : num;
      });

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }, [orders]);

  // Order CRUD
  const addOrder = useCallback(
    async (
      data: Omit<
        ServiceOrder,
        | 'id'
        | 'orderNumber'
        | 'createdAt'
        | 'updatedAt'
        | 'totalFinalSheets'
        | 'yieldPerSheet'
        | 'cutsDescription'
        | 'fullSheetsNeeded'
        | 'totalFactorySheetsUsed'
        | 'packagesCount'
        | 'efficiencyPercent'
      > & { id?: string; orderNumber?: string }
    ): Promise<ServiceOrder> => {
      const orderNumber = data.orderNumber || getNextOrderNumber();
      const math = calculateOrderMath({
        blocksQty: data.blocksQty,
        sheetsPerBlock: data.sheetsPerBlock,
        ways: data.ways,
        wayColors: data.wayColors,
        imagesPerPlate: data.imagesPerPlate || 1,
        breakMargin: data.breakMargin,
        sheetW: data.paperWidthMm,
        sheetH: data.paperHeightMm,
        cutW: data.cutWidthMm,
        cutH: data.cutHeightMm,
        materialType: data.materialType,
        unitMultiplier: data.unitMultiplier || data.sheetsPerBlock,
        surplusPercent: data.surplusPercent !== undefined ? data.surplusPercent : 10,
      });

      const packageSheets = data.packageSheets || 250;
      const packagesCount =
        packageSheets > 0
          ? Math.round((math.totalFactorySheetsUsed / packageSheets) * 10) / 10
          : 0;

      const now = Date.now();
      // ID Oficial: "BS [Número] - [CódigoDoMaterial]" (Ex: "BS 17 - 654-5125")
      const id =
        (data.orderNumber && data.orderNumber.startsWith('BS '))
          ? data.orderNumber
          : (data.bsNumber && data.serviceCode
            ? `BS ${data.bsNumber} - ${data.serviceCode}`
            : data.id || `os-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

      const newOrder: ServiceOrder = {
        ...data,
        id,
        orderNumber,
        totalFinalSheets: math.totalFinalSheets,
        yieldPerSheet: math.yieldPerSheet,
        cutsDescription: math.cutsDescription,
        fullSheetsNeeded: math.fullSheetsNeeded,
        totalFactorySheetsUsed: math.totalFactorySheetsUsed,
        packagesCount,
        efficiencyPercent: math.efficiencyPercent,
        createdAt: now,
        updatedAt: now,
      };

      setOrders((prev) => {
        const withoutSameId = prev.filter((o) => o.id !== id);
        const updated = [newOrder, ...withoutSameId];
        broadcastUpdate('SYNC_ORDERS', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'orders', id), newOrder);
          const metricDoc = buildDashboardMetricFromOrder(newOrder);
          await setDoc(doc(db, 'dashboard_metrics', id), metricDoc);
        } catch (e: any) {
          console.warn('[Firestore] Sincronização remota orders / dashboard_metrics:', e?.message || e);
        }
      }

      return newOrder;
    },
    [getNextOrderNumber, broadcastUpdate]
  );

  const updateOrder = useCallback(
    async (id: string, data: Partial<ServiceOrder>): Promise<ServiceOrder | undefined> => {
      let resultOrder: ServiceOrder | undefined;

      setOrders((prev) => {
        let matched = false;
        const updated = prev.map((ord) => {
          if (ord.id !== id) return ord;
          matched = true;

          const merged = { ...ord, ...data, updatedAt: Date.now() };

          const math = calculateOrderMath({
            blocksQty: merged.blocksQty,
            sheetsPerBlock: merged.sheetsPerBlock,
            ways: merged.ways,
            wayColors: merged.wayColors,
            imagesPerPlate: merged.imagesPerPlate || 1,
            breakMargin: merged.breakMargin,
            sheetW: merged.paperWidthMm,
            sheetH: merged.paperHeightMm,
            cutW: merged.cutWidthMm,
            cutH: merged.cutHeightMm,
            materialType: merged.materialType,
            unitMultiplier: merged.unitMultiplier || merged.sheetsPerBlock,
            surplusPercent: merged.surplusPercent !== undefined ? merged.surplusPercent : 10,
          });

          const packageSheets = merged.packageSheets || 250;
          const packagesCount =
            packageSheets > 0
              ? Math.round((math.totalFactorySheetsUsed / packageSheets) * 10) / 10
              : 0;

          const result: ServiceOrder = {
            ...merged,
            totalFinalSheets: math.totalFinalSheets,
            yieldPerSheet: math.yieldPerSheet,
            cutsDescription: math.cutsDescription,
            fullSheetsNeeded: math.fullSheetsNeeded,
            totalFactorySheetsUsed: math.totalFactorySheetsUsed,
            packagesCount,
            efficiencyPercent: math.efficiencyPercent,
          };

          resultOrder = result;
          return result;
        });

        // Garantia de substituição limpa pelo ID e eliminação de duplicatas
        const listToDedup = matched ? updated : (resultOrder ? [resultOrder, ...prev] : prev);
        const dedupMap = new Map<string, ServiceOrder>();
        for (const o of listToDedup) {
          if (o && o.id) {
            dedupMap.set(o.id, o);
          }
        }
        const finalOrders = Array.from(dedupMap.values()).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );

        broadcastUpdate('SYNC_ORDERS', finalOrders);
        return finalOrders;
      });

      if (isFirebaseConfigured && db && resultOrder) {
        try {
          await setDoc(doc(db, 'orders', id), resultOrder);
          const metricDoc = buildDashboardMetricFromOrder(resultOrder);
          await setDoc(doc(db, 'dashboard_metrics', id), metricDoc);
        } catch (e: any) {
          console.warn('[Firestore] Sincronização remota orders / dashboard_metrics:', e?.message || e);
        }
      }

      return resultOrder;
    },
    [broadcastUpdate]
  );

  const deleteOrder = useCallback(
    async (id: string): Promise<void> => {
      setOrders((prev) => {
        const updated = prev.filter((o) => o.id !== id);
        broadcastUpdate('SYNC_ORDERS', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        try {
          await deleteDoc(doc(db, 'orders', id));
          await deleteDoc(doc(db, 'dashboard_metrics', id));
        } catch (e: any) {
          console.warn('[Firestore] Exclusão remota orders / dashboard_metrics:', e?.message || e);
        }
      }
    },
    [broadcastUpdate]
  );

  const updateOrderStatus = useCallback(
    (id: string, status: OrderStatus) => {
      setOrders((prev) => {
        const updated = prev.map((o) => {
          if (o.id === id) {
            const updatedOrder = { ...o, status, updatedAt: Date.now() };
            if (isFirebaseConfigured && db) {
              setDoc(doc(db, 'orders', id), updatedOrder).catch((e) =>
                console.warn('[Firestore] Sincronização remota orders:', e?.message || e)
              );
              setDoc(doc(db, 'dashboard_metrics', id), buildDashboardMetricFromOrder(updatedOrder)).catch((e) =>
                console.warn('[Firestore] Sincronização remota dashboard_metrics:', e?.message || e)
              );
            }
            return updatedOrder;
          }
          return o;
        });
        broadcastUpdate('SYNC_ORDERS', updated);
        return updated;
      });
    },
    [broadcastUpdate]
  );

  // Papers CRUD
  const addPaper = useCallback((paper: Omit<PaperFactory, 'id'>) => {
    const id = `pap-${Date.now()}`;
    const newPaper: PaperFactory = { ...paper, id };
    setPapers((prev) => [...prev, newPaper]);
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'papers', id), newPaper).catch((e) =>
        console.warn('[Firestore] Sincronização remota papers:', e?.message || e)
      );
    }
  }, []);

  const updatePaper = useCallback((id: string, data: Partial<PaperFactory>) => {
    setPapers((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...data };
          if (isFirebaseConfigured && db) {
            setDoc(doc(db, 'papers', id), updated).catch((e) =>
              console.warn('[Firestore] Sincronização remota papers:', e?.message || e)
            );
          }
          return updated;
        }
        return p;
      })
    );
  }, []);

  const deletePaper = useCallback((id: string) => {
    setPapers((prev) => prev.filter((p) => p.id !== id));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, 'papers', id)).catch((e) =>
        console.warn('[Firestore] Exclusão remota papers:', e?.message || e)
      );
    }
  }, []);

  // Formats CRUD
  const addFormat = useCallback((format: Omit<CutFormat, 'id'>) => {
    const id = `fmt-${Date.now()}`;
    const newFormat: CutFormat = { ...format, id };
    setFormats((prev) => [...prev, newFormat]);
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'formats', id), newFormat).catch((e) =>
        console.warn('[Firestore] Sincronização remota formats:', e?.message || e)
      );
    }
  }, []);

  const updateFormat = useCallback((id: string, data: Partial<CutFormat>) => {
    setFormats((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const updated = { ...f, ...data };
          if (isFirebaseConfigured && db) {
            setDoc(doc(db, 'formats', id), updated).catch((e) =>
              console.warn('[Firestore] Sincronização remota formats:', e?.message || e)
            );
          }
          return updated;
        }
        return f;
      })
    );
  }, []);

  const deleteFormat = useCallback((id: string) => {
    setFormats((prev) => prev.filter((f) => f.id !== id));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, 'formats', id)).catch((e) =>
        console.warn('[Firestore] Exclusão remota formats:', e?.message || e)
      );
    }
  }, []);

  // Services CRUD
  const addService = useCallback((service: Omit<ServiceCatalog, 'id'>) => {
    const id = `srv-${Date.now()}`;
    const newService: ServiceCatalog = { ...service, id };
    setServices((prev) => [...prev, newService]);
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'services', id), newService).catch((e) =>
        console.warn('[Firestore] Sincronização remota services:', e?.message || e)
      );
    }
  }, []);

  const updateService = useCallback((id: string, data: Partial<ServiceCatalog>) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, ...data };
          if (isFirebaseConfigured && db) {
            setDoc(doc(db, 'services', id), updated).catch((e) =>
              console.warn('[Firestore] Sincronização remota services:', e?.message || e)
            );
          }
          return updated;
        }
        return s;
      })
    );
  }, []);

  const deleteService = useCallback((id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, 'services', id)).catch((e) =>
        console.warn('[Firestore] Exclusão remota services:', e?.message || e)
      );
    }
  }, []);

  // Responsibles CRUD (Add, Update, Delete)
  const addResponsible = useCallback((name: string, role?: string) => {
    const id = `resp-${Date.now()}`;
    const newResp: Responsible = { id, name: name.toUpperCase(), role: role || 'Operador Gráfico' };
    setResponsibles((prev) => [...prev, newResp]);
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'responsibles', id), newResp).catch((e) =>
        console.warn('[Firestore] Sincronização remota responsibles:', e?.message || e)
      );
    }
  }, []);

  const updateResponsible = useCallback((id: string, name: string, role?: string) => {
    setResponsibles((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, name: name.toUpperCase(), role: role || r.role || 'Operador Gráfico' };
          if (isFirebaseConfigured && db) {
            setDoc(doc(db, 'responsibles', id), updated).catch((e) =>
              console.warn('[Firestore] Sincronização remota responsibles:', e?.message || e)
            );
          }
          return updated;
        }
        return r;
      })
    );
  }, []);

  const deleteResponsible = useCallback((id: string) => {
    setResponsibles((prev) => prev.filter((r) => r.id !== id));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, 'responsibles', id)).catch((e) =>
        console.warn('[Firestore] Exclusão remota responsibles:', e?.message || e)
      );
    }
  }, []);

  // Machines CRUD
  const addMachine = useCallback((name: string, tech?: string) => {
    const id = `mach-${Date.now()}`;
    const newMach: Machine = { id: name, name, tech: tech || 'Impressão Gráfica' };
    setMachines((prev) => [...prev, newMach]);
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'machines', id), newMach).catch((e) =>
        console.warn('[Firestore] Sincronização remota machines:', e?.message || e)
      );
    }
  }, []);

  const deleteMachine = useCallback((id: string) => {
    setMachines((prev) => prev.filter((m) => m.id !== id));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, 'machines', id)).catch((e) =>
        console.warn('[Firestore] Exclusão remota machines:', e?.message || e)
      );
    }
  }, []);

  const resetDatabaseToDefault = useCallback(() => {
    const defOrders = createInitialOrders();
    setPapers(INITIAL_PAPERS);
    setFormats(INITIAL_FORMATS);
    setServices(INITIAL_SERVICES);
    setResponsibles(INITIAL_RESPONSIBLES);
    setMachines(INITIAL_MACHINES);
    setOrders(defOrders);

    localStorage.setItem(STORAGE_KEYS.PAPERS, JSON.stringify(INITIAL_PAPERS));
    localStorage.setItem(STORAGE_KEYS.FORMATS, JSON.stringify(INITIAL_FORMATS));
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(INITIAL_SERVICES));
    localStorage.setItem(STORAGE_KEYS.RESPONSIBLES, JSON.stringify(INITIAL_RESPONSIBLES));
    localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(INITIAL_MACHINES));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(defOrders));

    broadcastUpdate('SYNC_ALL', {
      orders: defOrders,
      papers: INITIAL_PAPERS,
      formats: INITIAL_FORMATS,
      services: INITIAL_SERVICES,
      responsibles: INITIAL_RESPONSIBLES,
      machines: INITIAL_MACHINES,
    });
  }, [broadcastUpdate]);

  return (
    <GraphicContext.Provider
      value={{
        orders,
        papers,
        formats,
        services,
        responsibles,
        machines,
        selectedOrderForPrint,
        setSelectedOrderForPrint,
        isFirebaseActive,
        sismatImportedCount,
        reimportarSismat,
        loadOlderOrdersFromFirestore,
        isFetchingOlderOrders,
        hasLoadedAllOrders,
        addOrder,
        updateOrder,
        handleUpdateOrder: updateOrder,
        editOrder: updateOrder,
        deleteOrder,
        updateOrderStatus,
        getNextOrderNumber,
        addPaper,
        updatePaper,
        deletePaper,
        addFormat,
        updateFormat,
        deleteFormat,
        addService,
        updateService,
        deleteService,
        addResponsible,
        updateResponsible,
        deleteResponsible,
        addMachine,
        deleteMachine,
        resetDatabaseToDefault,
      }}
    >
      {children}
    </GraphicContext.Provider>
  );
};

export const useGraphic = (): GraphicContextType => {
  const context = useContext(GraphicContext);
  if (!context) {
    throw new Error('useGraphic must be used within a GraphicProvider');
  }
  return context;
};
