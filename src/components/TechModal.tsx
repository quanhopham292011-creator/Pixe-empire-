import React from 'react';
import { TechBranch, TechNode, Nation, ResearchingTech } from '../types';
import { TECH_TREE } from '../utils/constants';
import { Coins, Swords, Shield, X, Clock, CheckCircle2 } from 'lucide-react';

interface TechModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  researching: ResearchingTech | null;
  onStartResearch: (tech: TechNode) => void;
}

export const TechModal: React.FC<TechModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  researching,
  onStartResearch,
}) => {
  if (!isOpen) return null;

  const branches: { id: TechBranch; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'ECONOMY', label: 'Kinh Tế', icon: <Coins className="w-4 h-4 text-amber-400" />, color: 'amber' },
    { id: 'MILITARY', label: 'Quân Sự', icon: <Swords className="w-4 h-4 text-red-400" />, color: 'red' },
    { id: 'DEFENSE', label: 'Phòng Thủ', icon: <Shield className="w-4 h-4 text-blue-400" />, color: 'blue' },
  ];

  const getBranchLevel = (branch: TechBranch) => {
    switch (branch) {
      case 'ECONOMY': return playerNation.techLevels.economy;
      case 'MILITARY': return playerNation.techLevels.military;
      case 'DEFENSE': return playerNation.techLevels.defense;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
          <div>
            <h3 className="font-bold text-white text-base">Viện Hàn Lâm Công Nghệ</h3>
            <p className="text-xs text-slate-400">Nghiên cứu để gia tăng sức mạnh lâu dài cho đế quốc</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {researching && (
          <div className="px-4 py-2.5 bg-blue-950/40 border-b border-blue-900/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-blue-300">
              <Clock className="w-4 h-4 animate-spin text-blue-400" />
              <span>Đang nghiên cứu...</span>
            </div>
            <span className="font-mono font-bold text-blue-200">
              {Math.ceil(researching.remainingTime)}s
            </span>
          </div>
        )}

        <div className="p-4 space-y-4 max-h-[72vh] overflow-y-auto">
          {branches.map(({ id: branchId, label, icon }) => {
            const currentLevel = getBranchLevel(branchId);
            const branchTechs = TECH_TREE.filter(t => t.branch === branchId);

            return (
              <div key={branchId} className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-3 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/50">
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="font-bold text-sm text-white">{label}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    Cấp {currentLevel}/3
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  {branchTechs.map((tech) => {
                    const isCompleted = currentLevel >= tech.level;
                    const isResearchingThis = researching?.techId === tech.id;
                    const canResearch = currentLevel === tech.level - 1 && !researching && playerNation.gold >= tech.cost;
                    const isLocked = currentLevel < tech.level - 1;

                    return (
                      <div
                        key={tech.id}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                          isCompleted
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-300'
                            : isResearchingThis
                            ? 'bg-blue-950/30 border-blue-500/50 text-white'
                            : isLocked
                            ? 'bg-slate-900/40 border-slate-800/50 text-slate-500'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 font-bold text-white">
                            <span>{tech.name}</span>
                            <span className="text-[10px] text-slate-400">Cấp {tech.level}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{tech.description}</p>
                          {!isCompleted && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-mono">
                              <span>💰 {tech.cost} Vàng</span>
                              <span>⏱️ {tech.researchTime}s</span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0">
                          {isCompleted ? (
                            <div className="flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Xong</span>
                            </div>
                          ) : isResearchingThis ? (
                            <div className="flex items-center gap-1 text-blue-400 font-semibold text-xs animate-pulse">
                              <Clock className="w-4 h-4" />
                              <span>{Math.ceil(researching.remainingTime)}s</span>
                            </div>
                          ) : (
                            <button
                              disabled={!canResearch}
                              onClick={() => onStartResearch(tech)}
                              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 ${
                                canResearch
                                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                              }`}
                            >
                              Học
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
