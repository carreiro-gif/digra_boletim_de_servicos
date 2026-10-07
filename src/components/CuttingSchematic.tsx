import React from 'react';
import { CutCalculationResult } from '../types';
import { Layers } from 'lucide-react';

interface CuttingSchematicProps {
  sheetW: number;
  sheetH: number;
  cutW: number;
  cutH: number;
  cutResult: CutCalculationResult;
  paperName?: string;
  cutFormatName?: string;
  compact?: boolean;
}

export const CuttingSchematic: React.FC<CuttingSchematicProps> = ({
  sheetW,
  sheetH,
  cutW,
  cutH,
  cutResult,
  compact = false,
}) => {
  // SVG canvas normalization: Maintain real aspect ratio
  const maxViewW = compact ? 300 : 420;
  const maxViewH = compact ? 200 : 280;

  // Scale factor to fit inside SVG view
  const scale = Math.min((maxViewW - 40) / sheetW, (maxViewH - 40) / sheetH);
  const svgSheetW = sheetW * scale;
  const svgSheetH = sheetH * scale;

  const offsetX = (maxViewW - svgSheetW) / 2;
  const offsetY = (maxViewH - svgSheetH) / 2;

  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-xs ${compact ? 'p-3' : 'p-5'}`}>
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-700" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Esquema Gráfico de Corte da Folha
          </h4>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
              cutResult.efficiencyPercent >= 80
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : cutResult.efficiencyPercent >= 65
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {cutResult.efficiencyPercent}% Aproveitamento
          </span>
        </div>
      </div>

      {/* SVG Canvas Container (Clean Light) */}
      <div className="bg-white rounded-xl p-3 flex items-center justify-center relative border border-slate-200 shadow-2xs overflow-hidden">
        <svg
          viewBox={`0 0 ${maxViewW} ${maxViewH}`}
          className="w-full max-h-[220px] select-none"
        >
          {/* Background Grid Pattern */}
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#f1f5f9" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width={maxViewW} height={maxViewH} fill="url(#grid)" />

          {/* Paper Sheet Outline */}
          <rect
            x={offsetX}
            y={offsetY}
            width={svgSheetW}
            height={svgSheetH}
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth="1.5"
            rx="3"
          />

          {/* Cuts Rectangles */}
          {cutResult.schematic.cuts.map((cut, idx) => {
            const cutX = offsetX + cut.x * scale;
            const cutY = offsetY + cut.y * scale;
            const cutWidth = cut.w * scale;
            const cutHeight = cut.h * scale;

            return (
              <g key={idx}>
                <rect
                  x={cutX + 0.5}
                  y={cutY + 0.5}
                  width={Math.max(1, cutWidth - 1)}
                  height={Math.max(1, cutHeight - 1)}
                  fill={cut.rotated ? '#0284c7' : '#2563eb'}
                  stroke="#1d4ed8"
                  strokeWidth="0.8"
                  opacity="0.9"
                  rx="1.5"
                />
                {cutWidth > 20 && cutHeight > 14 && (
                  <text
                    x={cutX + cutWidth / 2}
                    y={cutY + cutHeight / 2 + 3}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={Math.min(10, Math.max(7, cutHeight / 3))}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    #{idx + 1}
                  </text>
                )}
              </g>
            );
          })}

          {/* Dimension Labels on Sheet */}
          <text
            x={offsetX + svgSheetW / 2}
            y={Math.max(12, offsetY - 5)}
            textAnchor="middle"
            fill="#64748b"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {sheetW} mm
          </text>
          <text
            x={Math.max(10, offsetX - 6)}
            y={offsetY + svgSheetH / 2}
            textAnchor="middle"
            fill="#64748b"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
            transform={`rotate(-90 ${Math.max(10, offsetX - 6)} ${offsetY + svgSheetH / 2})`}
          >
            {sheetH} mm
          </text>
        </svg>

        {/* Legend Overlay */}
        <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] text-slate-700 border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 border border-blue-700"></span>
            <span className="font-semibold">Direto</span>
          </div>
          {cutResult.orientation !== 'direct' && (
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 border border-sky-700"></span>
              <span className="font-semibold">Girado (90°)</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-200 border border-slate-300"></span>
            <span className="font-semibold">Refugo ({cutResult.wastePercent}%)</span>
          </div>
        </div>
      </div>

      {/* Explanatory Technical Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-blue-900 font-black text-sm">
            {cutResult.yield} poses por folha
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 font-medium text-[11px]">{cutResult.description}</span>
        </div>
        <div className="text-[11px] text-slate-600 font-medium">
          Corte: <strong className="text-slate-900">{cutW}×{cutH} mm</strong> em Papel:{' '}
          <strong className="text-slate-900">{sheetW}×{sheetH} mm</strong>
        </div>
      </div>
    </div>
  );
};
