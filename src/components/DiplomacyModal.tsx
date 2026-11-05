import React from 'react';
import { Nation } from '../types';
import { formatPopulation } from '../utils/constants';
import { Handshake, Swords, Shield, X, Users, Castle, Navigation } from 'lucide-react';

interface DiplomacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  nations: Nation[];
  totalLandCount: number;
  onProposeTruce: (botId: number) => void;
  onProposeAlliance: (botId: number) => void;
  onDeclareWar: (botId: number) => void;
  onFocusNation?: (nationId: number) => void;
}

export const DiplomacyModal: React.FC<DiplomacyModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  nations,
  totalLandCount,
  onProposeTruce,
  onProposeAlliance,
  onDeclareWar,
  onFocusNation,
}) => {
  if (!isOpen) return null;

  const sortedNations = [...nations.filter(n => n.id > 0)].sort(
    (a, b) => b.territoryCount - a.territoryCount
  );

  const getPersonalityLabel = (personality: string) => {
    switch (personality) {
      case 'AGGRESSIVE': return { text: 'Hiếu Chiến', color: 'text-red-400 border-red-500/30' };
      case 'DEFENSIVE': return { text: 'Phòng Thủ', color: 'text-blue-400 border-blue-500/30' };
      case 'MERCHANT': return { text: 'Thương Nhân', color: 'text-amber-400 border-amber-500/30' };
      case 'OPPORTUNIST': return { text: 'Cơ Hội', color: 'text-purple-400 border-purple-500/30' };
      default: return { text: 'Cân Bằng', color: 'text-slate-400 border-slate-500/30' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
          <div>
            <h3 className="font-bold text-white text-base">Hội Nghị Ngoại Giao & Xếp Hạng</h3>
            <p className="text-xs text-slate-400">Quan hệ quốc tế và tình hình cán cân quyền lực thế giới</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[72vh] overflow-y-auto">
          {sortedNations.map((nation, index) => {
            const isSelf = nation.id === playerNation.id;
            const dip = playerNation.diplomacy[nation.id] || { status: 'WAR', relation: 0, truceTimer: 0 };
            const percent = totalLandCount > 0 ? Math.round((nation.territoryCount / totalLandCount) * 100) : 0;
            const pers = getPersonalityLabel(nation.personality);

            return (
              <div
                key={nation.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSelf
                    ? 'bg-blue-950/40 border-blue-500/50 shadow-sm'
                    : nation.isEliminated
                    ? 'bg-slate-950/40 border-slate-800/40 opacity-50'
                    : 'bg-slate-800/60 border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => {
                      if (onFocusNation) {
                        onFocusNation(nation.id);
                        onClose();
                      }
                    }}
                    className={`flex items-center gap-2 text-left group hover:opacity-90 transition-opacity ${
                      isSelf ? 'px-1.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20' : ''
                    }`}
                    title={isSelf ? "Bấm để di chuyển camera về vương quốc của bạn" : "Bấm để di chuyển camera tới quốc gia này"}
                  >
                    <span className="font-mono text-xs font-bold text-slate-400 w-5">#{index + 1}</span>
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: nation.color }} />
                    <span className="font-bold text-sm text-white flex items-center gap-1 group-hover:text-amber-400 transition-colors">
                      {isSelf && <Castle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      {nation.name}
                      {isSelf && <span className="text-[10px] text-amber-300 font-semibold ml-1">(Bạn • Xem)</span>}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {onFocusNation && !isSelf && !nation.isEliminated && (
                      <button
                        onClick={() => {
                          onFocusNation(nation.id);
                          onClose();
                        }}
                        title="Di chuyển camera tới quốc gia này"
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700/80 flex items-center gap-1 active:scale-95"
                      >
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        <span>Xem</span>
                      </button>
                    )}

                    {!isSelf && !nation.isEliminated && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${pers.color}`}>
                        {pers.text}
                      </span>
                    )}
                    {nation.isEliminated && (
                      <span className="text-[10px] text-red-400 italic">Đã bị diệt vong</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs text-slate-300 pb-2 border-b border-slate-800/60">
                  <span>🌍 {percent}% Đất ({nation.territoryCount} ô)</span>
                  <span>👥 {formatPopulation(nation.population || 0)} Dân</span>
                  <span>⚔️ {nation.troops} Quân</span>
                  <span>💰 {nation.gold} Vàng</span>
                </div>

                {isSelf && onFocusNation && (
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Vương quốc của bạn</span>
                    <button
                      onClick={() => {
                        onFocusNation(nation.id);
                        onClose();
                      }}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-lg text-xs border border-amber-500/40 flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                    >
                      <Castle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Về Vương Quốc Của Tôi</span>
                    </button>
                  </div>
                )}

                {!isSelf && !nation.isEliminated && (
                  <div className="pt-2 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      {dip.status === 'ALLIANCE' ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Handshake className="w-3.5 h-3.5" /> Đồng Minh ({Math.ceil(dip.truceTimer)}s)
                        </span>
                      ) : dip.status === 'TRUCE' ? (
                        <span className="text-blue-400 font-semibold flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" /> Đình Chiến ({Math.ceil(dip.truceTimer)}s)
                        </span>
                      ) : (
                        <span className="text-red-400 font-semibold flex items-center gap-1">
                          <Swords className="w-3.5 h-3.5" /> Đang Chiến Tranh
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {dip.status === 'WAR' ? (
                        <>
                          <button
                            onClick={() => onProposeTruce(nation.id)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <Shield className="w-3.5 h-3.5" /> Đình Chiến
                          </button>
                          <button
                            onClick={() => onProposeAlliance(nation.id)}
                            className="px-2.5 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <Handshake className="w-3.5 h-3.5" /> Liên Minh
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onDeclareWar(nation.id)}
                          className="px-2.5 py-1.5 bg-red-800/80 hover:bg-red-700 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          <Swords className="w-3.5 h-3.5" /> Tuyên Chiến
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
