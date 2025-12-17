import React from 'react';

interface CyberSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  color?: string;
}

export const CyberSlider: React.FC<CyberSliderProps> = ({ label, value, onChange, color = 'text-diesel-gold' }) => {
  return (
    <div className="flex flex-col gap-1 mb-4">
      <div className="flex justify-between items-end">
        <label className={`text-xs uppercase tracking-widest font-bold ${color}`}>
          {label}
        </label>
        <span className={`text-sm font-mono ${color}`}>{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-diesel-black appearance-none cursor-pointer border border-diesel-border accent-diesel-gold"
        style={{ accentColor: '#cba96d' }}
      />
    </div>
  );
};