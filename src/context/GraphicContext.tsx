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
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
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
    > & { orderNumber?: string }
  ) => ServiceOrder;
  updateOrder: (id: string, data: Partial<ServiceOrder>) => void;
  deleteOrder: (id: string) => void;
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
      return saved ? JSON.parse(saved) : INITIAL_SERVICES;
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
            setServices(res.services);
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

    try {
      const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteOrders = snapshot.docs.map((d) => d.data() as ServiceOrder);
          setOrders(remoteOrders);
        }
      });

      const unsubPapers = onSnapshot(collection(db, 'papers'), (snapshot) => {
        if (!snapshot.empty) {
          setPapers(snapshot.docs.map((d) => d.data() as PaperFactory));
        }
      });

      const unsubFormats = onSnapshot(collection(db, 'formats'), (snapshot) => {
        if (!snapshot.empty) {
          setFormats(snapshot.docs.map((d) => d.data() as CutFormat));
        }
      });

      const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
        if (!snapshot.empty) {
          setServices(snapshot.docs.map((d) => d.data() as ServiceCatalog));
        }
      });

      const unsubResponsibles = onSnapshot(collection(db, 'responsibles'), (snapshot) => {
        if (!snapshot.empty) {
          setResponsibles(snapshot.docs.map((d) => d.data() as Responsible));
        }
      });

      const unsubMachines = onSnapshot(collection(db, 'machines'), (snapshot) => {
        if (!snapshot.empty) {
          setMachines(snapshot.docs.map((d) => d.data() as Machine));
        }
      });

      return () => {
        unsubOrders();
        unsubPapers();
        unsubFormats();
        unsubServices();
        unsubResponsibles();
        unsubMachines();
      };
    } catch (err) {
      console.warn('Erro ao sincronizar Firestore:', err);
    }
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
        setServices(event.data.services);
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
        setSismatImportedCount(res.totalImported);
        setOrders(res.orders);
        setServices(res.services);
        setFormats(res.formats);
        setPapers(res.papers);
        broadcastUpdate('SYNC_ALL', {
          orders: res.orders,
          papers: res.papers,
          formats: res.formats,
          services: res.services,
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
    (
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
      > & { orderNumber?: string }
    ): ServiceOrder => {
      const orderNumber = data.orderNumber || getNextOrderNumber();
      const math = calculateOrderMath({
        blocksQty: data.blocksQty,
        sheetsPerBlock: data.sheetsPerBlock,
        ways: data.ways,
        imagesPerPlate: data.imagesPerPlate || 1,
        breakMargin: data.breakMargin,
        sheetW: data.paperWidthMm,
        sheetH: data.paperHeightMm,
        cutW: data.cutWidthMm,
        cutH: data.cutHeightMm,
      });

      const packageSheets = data.packageSheets || 250;
      const packagesCount =
        packageSheets > 0
          ? Math.round((math.totalFactorySheetsUsed / packageSheets) * 10) / 10
          : 0;

      const now = Date.now();
      const id = `os-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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
        const updated = [newOrder, ...prev];
        broadcastUpdate('SYNC_ORDERS', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        try {
          setDoc(doc(db, 'orders', id), newOrder);
        } catch (e) {
          console.error('Erro ao salvar no Firestore:', e);
        }
      }

      return newOrder;
    },
    [getNextOrderNumber, broadcastUpdate]
  );

  const updateOrder = useCallback(
    (id: string, data: Partial<ServiceOrder>) => {
      setOrders((prev) => {
        const updated = prev.map((ord) => {
          if (ord.id !== id) return ord;

          const merged = { ...ord, ...data, updatedAt: Date.now() };

          const math = calculateOrderMath({
            blocksQty: merged.blocksQty,
            sheetsPerBlock: merged.sheetsPerBlock,
            ways: merged.ways,
            imagesPerPlate: merged.imagesPerPlate || 1,
            breakMargin: merged.breakMargin,
            sheetW: merged.paperWidthMm,
            sheetH: merged.paperHeightMm,
            cutW: merged.cutWidthMm,
            cutH: merged.cutHeightMm,
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

          if (isFirebaseConfigured && db) {
            setDoc(doc(db, 'orders', id), result);
          }

          return result;
        });

        broadcastUpdate('SYNC_ORDERS', updated);
        return updated;
      });
    },
    [broadcastUpdate]
  );

  const deleteOrder = useCallback(
    (id: string) => {
      setOrders((prev) => {
        const updated = prev.filter((o) => o.id !== id);
        broadcastUpdate('SYNC_ORDERS', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        deleteDoc(doc(db, 'orders', id));
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
              setDoc(doc(db, 'orders', id), updatedOrder);
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
      setDoc(doc(db, 'papers', id), newPaper);
    }
  }, []);

  const updatePaper = useCallback((id: string, data: Partial<PaperFactory>) => {
    setPapers((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...data };
          if (isFirebaseConfigured && db) {
            setDoc(doc(db, 'papers', id), updated);
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
      deleteDoc(doc(db, 'papers', id));
    }
  }, []);

  // Formats CRUD
  const addFormat = useCallback((format: Omit<CutFormat, 'id'>) => {
    const id = `fmt-${Date.now()}`;
    const newFormat: CutFormat = { ...format, id };
    setFormats((prev) => [...prev, newFormat]);
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'formats', id), newFormat);
    }
  }, []);

  const updateFormat = useCallback((id: string, data: Partial<CutFormat>) => {
    setFormats((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const updated = { ...f, ...data };
          if (isFirebaseConfigured && db) {
            setDoc(doc(db, 'formats', id), updated);
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
      deleteDoc(doc(db, 'formats', id));
    }
  }, []);

  // Services CRUD
  const addService = useCallback((service: Omit<ServiceCatalog, 'id'>) => {
    const id = `srv-${Date.now()}`;
    const newService: ServiceCatalog = { ...service, id };
    setServices((prev) => [...prev, newService]);
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'services', id), newService);
    }
  }, []);

  const updateService = useCallback((id: string, data: Partial<ServiceCatalog>) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, ...data };
          if (isFirebaseConfigured && db) {
            setDoc(doc(db, 'services', id), updated);
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
      deleteDoc(doc(db, 'services', id));
    }
  }, []);

  // Responsibles CRUD (Add, Update, Delete)
  const addResponsible = useCallback((name: string, role?: string) => {
    const id = `resp-${Date.now()}`;
    const newResp: Responsible = { id, name: name.toUpperCase(), role: role || 'Operador Gráfico' };
    setResponsibles((prev) => [...prev, newResp]);
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'responsibles', id), newResp);
    }
  }, []);

  const updateResponsible = useCallback((id: string, name: string, role?: string) => {
    setResponsibles((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, name: name.toUpperCase(), role: role || r.role || 'Operador Gráfico' };
          if (isFirebaseConfigured && db) {
            setDoc(doc(db, 'responsibles', id), updated);
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
      deleteDoc(doc(db, 'responsibles', id));
    }
  }, []);

  // Machines CRUD
  const addMachine = useCallback((name: string, tech?: string) => {
    const id = `mach-${Date.now()}`;
    const newMach: Machine = { id: name, name, tech: tech || 'Impressão Gráfica' };
    setMachines((prev) => [...prev, newMach]);
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'machines', id), newMach);
    }
  }, []);

  const deleteMachine = useCallback((id: string) => {
    setMachines((prev) => prev.filter((m) => m.id !== id));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, 'machines', id));
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
        isFirebaseActive: isFirebaseConfigured,
        sismatImportedCount,
        reimportarSismat,
        addOrder,
        updateOrder,
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
