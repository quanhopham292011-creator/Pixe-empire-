import React from 'react';
import { GameEvent } from '../types';
import { Bell, ChevronRight, X } from 'lucide-react';

interface EventTickerProps {
  events: GameEvent[];
  onOpenLog: () => void;
}

export const EventTicker: React.FC<EventTickerProps> = ({ events, onOpenLog }) => {
  const latestEvent = events[0];
  if (!latestEvent) return null;

  return (
    <div
      onClick={onOpenLog}
      className="max-w-xs sm:max-w-sm px-3 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-full shadow-lg backdrop-blur-md flex items-center gap-2 cursor-pointer hover:bg-slate-800 transition-all active:scale-95"
    >
      <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
      <span className="text-[11px] font-medium text-slate-200 truncate flex-1">
        {latestEvent.title}: {latestEvent.description}
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
    </div>
  );
};

interface EventLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: GameEvent[];
}

export const EventLogModal: React.FC<EventLogModalProps> = ({ isOpen, onClose, events }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-white text-base">Nhật Ký Sự Kiện Lịch Sử</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 max-h-[65vh] overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Chưa có sự kiện nào được ghi nhận.</p>
          ) : (
            events.map((evt) => (
              <div key={evt.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                  <span className="font-semibold text-amber-400">{evt.title}</span>
                  <span className="font-mono">{evt.timestamp}</span>
                </div>
                <p className="text-slate-300">{evt.description}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
