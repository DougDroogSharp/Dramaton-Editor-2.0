import React from 'react';

interface CyberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const CyberInput: React.FC<CyberInputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1 mb-2 shrink-0">
      <label className="text-xs uppercase tracking-widest text-diesel-gold font-bold">
        {label}
      </label>
      <input
        className={`bg-diesel-black border border-diesel-border text-diesel-paper p-2 focus:outline-none focus:border-diesel-gold focus:shadow-diesel-glow transition-all placeholder-diesel-steel disabled:opacity-50 ${className}`}
        autoComplete="off"
        onFocus={(e) => e.target.select()}
        {...props}
      />
    </div>
  );
};