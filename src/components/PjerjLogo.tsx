import React from 'react';

export interface PjerjLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const PjerjLogo: React.FC<PjerjLogoProps> = ({
  className,
  size,
  showText = true,
}) => {
  return (
    <div className={`flex items-center gap-4 select-none ${className || ''}`}>
      <img 
        src="/logo-pjerj.png" 
        alt="Logo Oficial PJERJ" 
        width={size}
        height={size}
        className="w-16 h-16 object-contain print:w-14 print:h-14" 
        onError={(e) => {
          // Fallback de segurança para garantir a renderização
          e.currentTarget.src = "./logo-pjerj.png";
        }}
      />
      {showText && (
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-bold tracking-wide text-slate-700 uppercase print:text-[9px] print:font-bold">
            PODER JUDICIÁRIO DO ESTADO DO RIO DE JANEIRO
          </span>
          <span className="text-xl sm:text-2xl font-black tracking-wider text-slate-900 uppercase print:text-base print:font-black">
            DIGRA - DIVISÃO GRÁFICA
          </span>
        </div>
      )}
    </div>
  );
};

export default PjerjLogo;
