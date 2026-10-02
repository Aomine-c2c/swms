'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Clock, Wifi } from 'lucide-react';

export const Header: React.FC = () => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-zinc-200 px-6 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-900 text-[11px] font-semibold">
          <span className="w-2 h-2 rounded-full bg-zinc-900" />
          <span>Scale 01: READY</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
          <Activity className="w-3.5 h-3.5 text-zinc-400" />
          <span>Indicator Zero: ±0.00 kg</span>
        </div>
      </div>

      <div className="flex items-center gap-5 text-xs text-zinc-600 font-medium">
        <div className="flex items-center gap-1.5 font-mono tabular-nums text-zinc-900 bg-zinc-100 px-2 py-1 rounded border border-zinc-200">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span>{time || '--:--:--'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-600 text-xs">
          <Wifi className="w-3.5 h-3.5 text-zinc-800" />
          <span>Server Sync: Active</span>
        </div>
      </div>
    </header>
  );
};
