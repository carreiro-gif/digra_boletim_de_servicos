import React from 'react';
import { ServiceOrder } from '../types';
import { calculateCutYield } from '../utils/graphicMath';
import { Printer, X, Scissors } from 'lucide-react';

interface PrintA4OrderModalProps {
  order: ServiceOrder | null;
  onClose: () => void;
}

export const PrintA4OrderModal: React.FC<PrintA4OrderModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const cutResult = calculateCutYield(
    order.paperWidthMm,
    order.paperHeightMm,
    order.cutWidthMm,
    order.cutHeightMm
  );

  // Dynamic cutting nomenclature: "CORTE PARA IMPRESSÃO: [NOME] (FORMATO X)"
  const rawFormat = (order.cutFormatName || 'PADRÃO').trim().toUpperCase().replace(/^CORTE\s+(?:PARA\s+IMPRESSÃO:\s*)?/i, '');
  const cuttingTitle = `CORTE PARA IMPRESSÃO: ${rawFormat} (FORMATO ${order.yieldPerSheet})`;

  // Clean O.S. number without '#'
  const cleanOrderNumber = (order.orderNumber || '').replace(/^#/, '');

  // Número do Boletim de Serviço (BS) destacado
  const displayBsNumber = (() => {
    if (order.bsNumber !== undefined && order.bsNumber !== null && String(order.bsNumber).trim() !== '') {
      return String(order.bsNumber).trim();
    }
    const match =
      (order.orderNumber || '').match(/BS\s*(\d+)/i) ||
      (order.bsCodeKey || '').match(/BS\s*(\d+)/i) ||
      (order.observation || '').match(/BS\s*(\d+)/i) ||
      (order.orderNumber || '').match(/[-#](\d+)$/);
    return match ? match[1] : '';
  })();

  // Total de folhas inteiras a cortar pelo guilhotineiro (com sobra incluída)
  const totalSheetsToCut = Math.ceil(order.totalFactorySheetsUsed || 0);

  // SVG Thumbnail Normalization - Compactado para liberar 3 a 4 cm verticais
  const svgBoxW = 140;
  const svgBoxH = 58;
  const maxInnerW = 110;
  const maxInnerH = 42;
  const scale = Math.min(
    maxInnerW / (order.paperWidthMm || 660),
    maxInnerH / (order.paperHeightMm || 960)
  );
  const svgSheetW = (order.paperWidthMm || 660) * scale;
  const svgSheetH = (order.paperHeightMm || 960) * scale;
  const offsetX = (svgBoxW - svgSheetW) / 2;
  const offsetY = 8;

  // 9 Operative Sectors required for physical shop tracking
  const productionSectors = [
    { id: 1, name: '1. ARTE FINAL', desc: 'Prova & Gravação CTP' },
    { id: 2, name: '2. GRAVAÇÃO DE CHAPAS', desc: 'Matrizes Térmicas' },
    { id: 3, name: '3. CORTE (PREPARAÇÃO)', desc: `Guilhotina / Corte para Impressão ${order.cutFormatName || ''}` },
    { id: 4, name: '4. IMPRESSÃO', desc: order.machine || 'Offset / Digital' },
    { id: 5, name: '5. ACABAMENTO', desc: 'Intercalação / Blocagem' },
    { id: 6, name: '6. VINCO / DOBRA', desc: 'Vincadeira / Dobradeira' },
    { id: 7, name: '7. GRAMPO / BROCHURA', desc: 'Grampeação / Encadernação' },
    { id: 8, name: '8. CORTE FINAL (REFILE)', desc: order.finalCutSize ? `Refile no Tamanho Final: ${order.finalCutSize}` : `Refile no Formato do Trabalho` },
    { id: 9, name: '9. EMPACOTAMENTO', desc: 'Expedição & Entrega' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:m-0 print:bg-white print:static print:inset-auto print:block print:w-full print:h-auto">
      {/* Estilo Global Rigoroso de Impressão A4 (Trava de 1 Página) */}
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden !important;
          }
          @page {
            size: A4 portrait;
            margin: 5mm 6mm 5mm 6mm !important;
          }
        }
      `}</style>

      {/* Top Floating Control Bar (Always hidden in print) */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 print:hidden bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-2xl">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-black px-4 py-2 rounded-lg text-sm transition-all shadow-md active:scale-95 cursor-pointer border border-blue-600"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir O.S. (1 Página A4 Laser)</span>
        </button>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Fechar Visualização"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Printable Sheet Container (Trava Estrita max-h-[275mm] para caber 100% em 1 folha A4) */}
      <div
        id="printable-a4-sheet"
        style={{ maxHeight: '275mm' }}
        className="bg-white text-black w-full max-w-[210mm] max-h-[275mm] box-border shadow-2xl rounded-xs p-4 sm:p-5 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none print:block font-sans select-none flex flex-col justify-between"
      >
        <div>
          {/* ================= 1. REESTRUTURAÇÃO DO CABEÇALHO (LOGO, DIGRA, O.S.) ================= */}
          <div className="border-black border-[1px] rounded-xs p-2 mb-1.5 bg-white flex items-center justify-between gap-4">
            {/* Left: Brasão PJERJ + DIGRA em Negrito Forte */}
            <div className="flex items-center gap-3 flex-1">
              <img
                src="/logo-pjerj.png"
                alt="Brasão Oficial PJERJ"
                className="w-14 h-14 object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.src = './logo-pjerj.png';
                }}
              />
              <div className="flex flex-col justify-center">
                <span className="text-[9.5px] font-bold tracking-wider text-black uppercase leading-none mb-1">
                  PODER JUDICIÁRIO DO ESTADO DO RIO DE JANEIRO
                </span>
                <span className="text-xl sm:text-2xl font-black tracking-wider text-black uppercase leading-tight">
                  DIGRA - DIVISÃO GRÁFICA
                </span>
                <span className="text-[8.5px] font-bold text-slate-700 uppercase tracking-widest mt-0.5 leading-none">
                  Boletim de Trabalho &bull; Gestão e Engenharia de Produção
                </span>
              </div>
            </div>

            {/* Right: Bloco da O.S. Centralizado Horizontal e Verticalmente */}
            <div className="border-l border-black border-l-[1px] pl-4 pr-2 py-0.5 flex flex-col items-center justify-center text-center shrink-0 min-w-[185px]">
              <span className="text-[8.5px] uppercase font-bold text-black tracking-wider leading-none">
                NÚMERO DA O.S.
              </span>
              <span className="text-xl font-black font-mono tracking-tight text-black my-0.5 leading-none">
                {cleanOrderNumber}
              </span>
              <span className="text-[12px] font-black uppercase text-black tracking-wide leading-tight my-1 border-y border-black py-0.5 w-full block">
                BOLETIM DE SERVIÇO: BS {displayBsNumber || cleanOrderNumber}
              </span>
              <span className="text-[9.5px] font-bold uppercase text-black leading-tight">
                PRODUÇÃO: {order.productionMonth || (order.dateEmission ? new Date(order.dateEmission + 'T12:00:00').toLocaleDateString('pt-BR') : 'MÊS / ANO')}
              </span>
            </div>
          </div>

          {/* ================= 2. CABEÇALHO OPERACIONAL DE PRODUÇÃO ================= */}
          <div className="border-black border-[1px] rounded-xs mb-1.5 grid grid-cols-2 divide-x divide-black divide-x-[1px] bg-slate-50">
            <div className="px-3 py-1">
              <span className="block text-[8px] uppercase font-bold text-black leading-none">
                Máquina de Impressão
              </span>
              <strong className="text-xs font-black text-black uppercase block truncate mt-0.5">
                {order.machine}
              </strong>
            </div>
            <div className="px-3 py-1">
              <span className="block text-[8px] uppercase font-bold text-black leading-none">
                Responsável pelo Preenchimento
              </span>
              <strong className="text-xs font-black text-black uppercase block truncate mt-0.5">
                {order.createdBy}
              </strong>
            </div>
          </div>

          {/* ================= 3. TRABALHO / SERVIÇO & CÓDIGO DO MATERIAL ================= */}
          <div className="border-black border-[1px] rounded-xs p-2 mb-1.5 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Left: Nome do Serviço + Categoria */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[8px] font-bold text-black uppercase tracking-wider">
                    Descrição Oficial do Trabalho Gráfico
                  </span>
                  {order.serviceCategory && (
                    <span className="px-1.5 py-0.2 bg-slate-100 text-black border border-black border-[1px] text-[7.5px] font-black uppercase rounded-xs">
                      {order.serviceCategory}
                    </span>
                  )}
                </div>
                <h2 className="text-sm sm:text-base font-black text-black leading-tight">
                  {order.serviceName}
                </h2>
              </div>

              {/* Right: CORTE FINAL (PRODUTO ACABADO) + CÓDIGO DO MATERIAL */}
              <div className="flex items-center gap-2">
                <div className="bg-slate-50 text-black px-2.5 py-1 rounded-xs border-black border-[1px] text-center shrink-0 min-w-[115px]">
                  <span className="block text-[7px] uppercase tracking-widest text-black font-bold leading-none">
                    CORTE FINAL (REFILE)
                  </span>
                  <span className="text-xs font-black font-mono tracking-tight text-black block mt-0.5 leading-none">
                    {order.finalCutSize || 'CONFORME MODELO'}
                  </span>
                </div>
                <div className="bg-slate-50 text-black px-3 py-1 rounded-xs border-black border-[1px] text-center shrink-0 min-w-[125px]">
                  <span className="block text-[7px] uppercase tracking-widest text-black font-bold leading-none">
                    CÓDIGO DO MATERIAL
                  </span>
                  <span className="text-xl font-black font-mono tracking-wider text-black block mt-0.5 leading-none">
                    {order.serviceCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Condicional de Impressão: Oculta se vazio */}
            {order.observation && order.observation.trim() !== '' && (
              <div className="mt-1 text-[9px] text-black bg-slate-50 p-1 border-black border-[1px] rounded-xs">
                <strong className="font-black uppercase text-[8.5px] text-black">
                  Observação Técnica:
                </strong>{' '}
                {order.observation}
              </div>
            )}
          </div>

          {/* ================= 4. TABELA DE ESPECIFICAÇÃO & CONSUMO DE PAPEL (RETÍCULA 30%) ================= */}
          <div className="mb-1.5">
            <div className="bg-slate-300 text-black border-black border-[1px] px-2.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider flex items-center justify-between rounded-t-xs">
              <span>Logística de Produção e Consumo de Papel</span>
              <span className="font-mono text-black font-bold">DIGRA • PJERJ</span>
            </div>

            <table className="w-full border-collapse border-black border-[1px] text-[9.5px]">
              <tbody>
                {/* Row 1: Especificações do Papel */}
                <tr className="border-b-black border-b-[1px] divide-x divide-black divide-x-[1px] bg-slate-50 font-semibold">
                  <td className="p-1 w-1/4 text-center">
                    <span className="block text-[7.5px] uppercase font-bold text-black mb-0.5 leading-none">
                      PAPEL
                    </span>
                    <strong className="text-[11px] font-black text-black block text-center uppercase leading-tight truncate">
                      {order.paperName}
                    </strong>
                  </td>
                  <td className="p-1 w-1/4 text-center">
                    <span className="block text-[7.5px] uppercase font-bold text-black mb-0.5 leading-none">
                      FORMATO DO PAPEL (BRUTO)
                    </span>
                    <strong className="text-xs font-black font-mono text-black block text-center leading-tight">
                      {order.paperWidthMm} × {order.paperHeightMm} mm
                    </strong>
                  </td>
                  <td className="p-1 w-1/4 text-center">
                    <span className="block text-[7.5px] uppercase font-bold text-black mb-0.5 leading-none">
                      CORTE PARA IMPRESSÃO
                    </span>
                    <strong className="text-xs font-black font-mono text-black block text-center leading-tight">
                      {order.cutFormatName}
                      <span className="block text-[8.5px] font-bold text-black">
                        ({order.cutWidthMm} × {order.cutHeightMm} mm)
                      </span>
                    </strong>
                  </td>
                  <td className="p-1 w-1/4 text-center">
                    <span className="block text-[7.5px] uppercase font-bold text-black mb-0.5 leading-none">
                      PACOTE DE ESTOQUE
                    </span>
                    <strong className="text-[11px] font-black font-mono text-black block text-center leading-tight">
                      {order.packageSheets || 250} folhas / pct
                    </strong>
                  </td>
                </tr>

                {/* Row 2: Quantidades de Entrada & Imagens por Chapa */}
                <tr className="border-b-black border-b-[1px] divide-x divide-black divide-x-[1px] bg-white">
                  <td className="p-1 text-center">
                    <span className="block text-[7.5px] uppercase font-bold text-black leading-none">
                      Quantidade
                    </span>
                    <strong className="text-xs font-black font-mono text-black mt-0.5 block">
                      {order.blocksQty}
                    </strong>
                  </td>
                  <td className="p-1 text-center">
                    <span className="block text-[7.5px] uppercase font-bold text-black leading-none">
                      Folhas por Bloco
                    </span>
                    <strong className="text-xs font-black font-mono text-black mt-0.5 block">
                      {order.sheetsPerBlock && order.sheetsPerBlock > 1 ? order.sheetsPerBlock : '-'}
                    </strong>
                  </td>
                  <td className="p-1 text-center">
                    <span className="block text-[7.5px] uppercase font-bold text-black leading-none">
                      Vias
                    </span>
                    <strong className="text-xs font-black font-mono text-black mt-0.5 block">
                      {order.ways && order.ways > 1 ? `${order.ways} via(s)` : '-'}
                    </strong>
                  </td>
                  <td className="p-1 text-center bg-slate-50">
                    <span className="block text-[7.5px] uppercase font-bold text-black leading-none">
                      Imagens por Chapa
                    </span>
                    <strong className="text-xs font-black font-mono text-black mt-0.5 block">
                      {order.imagesPerPlate || 1} img/chapa
                    </strong>
                  </td>
                </tr>

                {/* Row 3: Matemática do Corte e Gasto Total com SOBRA */}
                <tr className="divide-x divide-black divide-x-[1px] border-b-black border-b-[1px] bg-white">
                  <td className="p-1 text-center">
                    <span className="block text-[7.5px] uppercase font-bold text-black leading-none">
                      Total Folhas Impressas
                    </span>
                    <strong className="text-xs font-black font-mono text-black mt-0.5 block">
                      {order.totalFinalSheets.toLocaleString('pt-BR')} fls
                    </strong>
                  </td>
                  <td className="p-1 text-center">
                    <span className="block text-[7.5px] uppercase font-bold text-black leading-none">
                      Aproveitamento do Papel
                    </span>
                    <strong className="text-[11px] font-black text-black mt-0.5 block leading-tight">
                      {cuttingTitle}
                    </strong>
                  </td>
                  <td className="p-1 text-center">
                    <span className="block text-[7.5px] uppercase font-bold text-black leading-none">
                      SOBRA (ACERTO)
                    </span>
                    <strong className="text-xs font-black font-mono text-black mt-0.5 block">
                      +{order.breakMargin || 0} un
                    </strong>
                  </td>
                  <td className="p-1 text-center bg-slate-100">
                    <span className="block text-[7.5px] uppercase font-black text-black tracking-wider leading-none">
                      GASTO TOTAL DE PAPEL (FLS)
                    </span>
                    <strong className="text-sm font-black font-mono text-black mt-0.5 block">
                      {totalSheetsToCut.toLocaleString('pt-BR')} FOLHAS
                    </strong>
                    <span className="block text-[7px] font-bold text-black leading-none mt-0.5">
                      ~ {Math.ceil(totalSheetsToCut / (order.packageSheets || 250))} pct fechado(s)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ================= 5. GUIA DE PROGRAMAÇÃO DA GUILHOTINA COMPACTA ================= */}
          <div className="border-black border-[1px] rounded-xs p-2 mb-1.5 bg-white">
            <div className="flex items-center justify-between gap-4">
              {/* Left Info: Nomenclatura Técnica e Descrição */}
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Scissors className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="text-[9px] font-black uppercase text-black tracking-wider leading-none">
                    Guia de Programação da Guilhotina (Corte para Impressão)
                  </span>
                </div>
                <div className="text-lg font-bold text-black tracking-tight leading-tight">
                  {cuttingTitle}
                </div>
                <p className="text-[8.5px] text-black italic leading-snug mt-1">
                  {order.cutsDescription} &bull; Linhas pontilhadas indicam o plano de divisão da lâmina da guilhotina para a entrada na impressora.
                </p>
              </div>

              {/* Right: Miniatura Visual em SVG Compactada (h-14 sm:h-16) */}
              <div className="bg-white border-black border-[1px] p-1 rounded-xs shrink-0 flex flex-col items-center">
                <svg
                  viewBox={`0 0 ${svgBoxW} ${svgBoxH}`}
                  width={svgBoxW}
                  height={svgBoxH}
                  className="overflow-visible h-14 sm:h-16 w-auto"
                >
                  {/* Paper Sheet Outline */}
                  <rect
                    x={offsetX}
                    y={offsetY}
                    width={svgSheetW}
                    height={svgSheetH}
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth="1"
                  />

                  {/* Dotted Cut Division Lines from Engine */}
                  {cutResult.schematic.cuts.map((cut, idx) => {
                    const cx = offsetX + cut.x * scale;
                    const cy = offsetY + cut.y * scale;
                    const cw = cut.w * scale;
                    const ch = cut.h * scale;

                    return (
                      <g key={idx}>
                        <rect
                          x={cx}
                          y={cy}
                          width={cw}
                          height={ch}
                          fill="#ffffff"
                          stroke="#000000"
                          strokeWidth="0.8"
                          strokeDasharray="3,3"
                        />
                        {cw > 12 && ch > 8 && (
                          <text
                            x={cx + cw / 2}
                            y={cy + ch / 2 + 2.5}
                            textAnchor="middle"
                            fill="#000000"
                            fontSize={Math.min(8, Math.max(5.5, ch / 2.5))}
                            fontWeight="900"
                            fontFamily="monospace"
                          >
                            #{idx + 1}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Sheet Dimension Labels (Top & Left) */}
                  <text
                    x={offsetX + svgSheetW / 2}
                    y={offsetY - 2}
                    textAnchor="middle"
                    fill="#000000"
                    fontSize="7"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {order.paperWidthMm} mm
                  </text>
                  <text
                    x={offsetX - 2}
                    y={offsetY + svgSheetH / 2}
                    textAnchor="middle"
                    fill="#000000"
                    fontSize="7"
                    fontWeight="bold"
                    fontFamily="monospace"
                    transform={`rotate(-90 ${offsetX - 2} ${offsetY + svgSheetH / 2})`}
                  >
                    {order.paperHeightMm} mm
                  </text>
                </svg>
                <div className="text-[7.5px] font-bold font-mono text-black tracking-wider uppercase mt-0.5 leading-none">
                  Corte p/ Impressão: {order.cutWidthMm}×{order.cutHeightMm} mm
                </div>
              </div>
            </div>

            {/* Linha de Comando Direto Unificada Compacta (mt-1, p-1.5) */}
            <div className="text-xs sm:text-sm font-black uppercase text-black tracking-wide bg-slate-50 p-1.5 border border-slate-300 rounded mt-1 block w-full text-center leading-tight">
              ✂️ CORTADOR: CORTAR EXATAMENTE {totalSheetsToCut.toLocaleString('pt-BR')} FOLHAS INTEIRAS {(order.paperName || 'PAPEL').toUpperCase()} NO FORMATO DE CORTE PARA IMPRESSÃO {rawFormat} (FORMATO {order.yieldPerSheet})
            </div>
          </div>

          {/* ================= 6. COMPACTAÇÃO RIGOROSA DAS 9 LINHAS DE PRODUÇÃO (h-8) ================= */}
          <div className="mb-1">
            <div className="bg-slate-300 text-black border-black border-[1px] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider flex items-center justify-between rounded-t-xs">
              <span>Controle Físico dos Setores de Produção (Marcação Obrigatória à Caneta)</span>
              <span className="text-[7.5px] font-bold text-black">9 Etapas Operacionais</span>
            </div>

            <table className="w-full border-collapse border-black border-[1px] text-[8.5px]">
              <thead>
                <tr className="bg-slate-100 text-black uppercase font-black divide-x divide-black divide-x-[1px] border-b-black border-b-[1px] text-[8px] h-4.5">
                  <th className="px-2 py-0.5 text-left w-[30%]">Setor de Produção</th>
                  <th className="px-2 py-0.5 text-left w-[28%]">Operador Responsável</th>
                  <th className="px-2 py-0.5 text-center w-[16%]">Início (Data / Hora)</th>
                  <th className="px-2 py-0.5 text-center w-[16%]">Término (Data / Hora)</th>
                  <th className="px-2 py-0.5 text-center w-[10%]">Rubrica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black divide-y-[1px]">
                {productionSectors.map((sector) => (
                  <tr key={sector.id} className="divide-x divide-black divide-x-[1px] h-8 max-h-8">
                    {/* Setor: Nome Ampliado em Negrito Forte */}
                    <td className="px-2 py-0 bg-slate-50 flex flex-col justify-center h-8 overflow-hidden">
                      <span className="font-black text-[10px] text-black uppercase tracking-wide leading-tight truncate">
                        {sector.name}
                      </span>
                      <span className="text-[7.5px] font-semibold text-slate-700 leading-none mt-0.5 truncate">
                        {sector.desc}
                      </span>
                    </td>

                    {/* Operador: Quadrado 100% LIMPO no meio, linha fina preta 1px de pauta na base */}
                    <td className="px-2 py-0 bg-white relative h-8">
                      <div className="h-full flex flex-col justify-end pb-0.5">
                        <div className="w-full border-b border-black border-b-[1px]"></div>
                      </div>
                    </td>

                    {/* Início: Quadrado 100% LIMPO no meio, linha fina preta 1px de pauta na base */}
                    <td className="px-2 py-0 bg-white relative h-8">
                      <div className="h-full flex flex-col justify-end pb-0.5">
                        <div className="w-full border-b border-black border-b-[1px]"></div>
                      </div>
                    </td>

                    {/* Término: Quadrado 100% LIMPO no meio, linha fina preta 1px de pauta na base */}
                    <td className="px-2 py-0 bg-white relative h-8">
                      <div className="h-full flex flex-col justify-end pb-0.5">
                        <div className="w-full border-b border-black border-b-[1px]"></div>
                      </div>
                    </td>

                    {/* Rubrica: Quadrado 100% LIMPO no meio, linha fina preta 1px de pauta na base */}
                    <td className="px-2 py-0 bg-white relative h-8">
                      <div className="h-full flex flex-col justify-end pb-0.5">
                        <div className="w-full border-b border-black border-b-[1px]"></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= 7. RODAPÉ DE VALIDAÇÃO INSTITUCIONAL (LINHA ÚNICA) ================= */}
        <div className="border-t border-black border-t-[1px] pt-1 flex items-center justify-between text-[7px] text-black font-semibold uppercase tracking-wider">
          <span>PODER JUDICIÁRIO DO ESTADO DO RIO DE JANEIRO &bull; DIGRA - DIVISÃO GRÁFICA</span>
          <span>EMITIDO ELETRONICAMENTE EM {new Date().toLocaleString('pt-BR')}</span>
          <span className="font-mono font-black text-black">O.S. {cleanOrderNumber} &bull; PÁGINA 1/1</span>
        </div>
      </div>
    </div>
  );
};

export default PrintA4OrderModal;
