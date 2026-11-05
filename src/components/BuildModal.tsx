import React, { useState } from 'react';
import { BuildingType, Tile, Nation } from '../types';
import { BUILDING_INFO } from '../utils/constants';
import { Building2, Swords, Shield, Anchor, Crosshair, X, Check, Layers } from 'lucide-react';

interface BuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTile: Tile | null;
  playerNation: Nation;
  existingBuildingCounts: Record<BuildingType, number>;
  onBuild: (type: BuildingType, count: number) => void;
}

type BatchOption = 1 | 2 | 5 | 10 | 20 | 50 | 100 | 'MAX';

export const BuildModal: React.FC<BuildModalProps> = ({
  isOpen,
  onClose,
  selectedTile,
  playerNation,
  existingBuildingCounts,
  onBuild,
}) => {
  const [selectedBatch, setSelectedBatch] = useState<BatchOption>(1);

  if (!isOpen || !selectedTile) return null;

  const batchOptions: BatchOption[] = [1, 2, 5, 10, 20, 50, 100, 'MAX'];

  const calculateBatchCost = (type: Exclude<BuildingType, 'NONE'>, goal: BatchOption) => {
    const base = BUILDING_INFO[type].baseCost;
    const currentCount = existingBuildingCounts[type] || 0;
    const discount = playerNation.techLevels?.economy >= 2 ? 0.85 : 1.0;
    const gold = playerNation.gold || 0;

    let totalCost = 0;
    let actualCount = 0;
    const limit = goal === 'MAX' ? 9999 : goal;

    for (let i = 0; i < limit; i++) {
      const singleCost = Math.floor(base * Math.pow(1.15, currentCount + i) * discount);
      if (goal !== 'MAX') {
        totalCost += singleCost;
        actualCount++;
      } else {
        if (totalCost + singleCost <= gold) {
          totalCost += singleCost;
          actualCount++;
        } else {
          break;
        }
      }
    }

    if (goal === 'MAX' && actualCount === 0) {
      actualCount = 1;
      totalCost = Math.floor(base * Math.pow(1.15, currentCount) * discount);
    }

    return { totalCost, actualCount };
  };

  const buildingTypes: Array<Exclude<BuildingType, 'NONE'>> = ['CITY', 'BARRACKS', 'FORTRESS', 'PORT', 'ARTILLERY'];

  const getIcon = (type: BuildingType) => {
    switch (type) {
      case 'CITY': return <Building2 className="w-4 h-4 text-amber-400" />;
      case 'BARRACKS': return <Swords className="w-4 h-4 text-red-400" />;
      case 'FORTRESS': return <Shield className="w-4 h-4 text-blue-400" />;
      case 'PORT': return <Anchor className="w-4 h-4 text-cyan-400" />;
      case 'ARTILLERY': return <Crosshair className="w-4 h-4 text-purple-400" />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-2 sm:p-3">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-amber-400" /> Xây Dựng Hàng Loạt
              </h3>
              <span className="text-xs bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                💰 {playerNation.gold.toLocaleString()} Vàng
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              Vị trí chọn ({selectedTile.x}, {selectedTile.y}) · {selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng' : 'Núi'} {selectedTile.hasHarborAccess ? '· Giáp biển' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl active:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* THANH CHỌN SỐ LƯỢNG XÂY GỘP (BATCH BUILD) */}
        <div className="px-3.5 py-2 bg-slate-950/80 border-b border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span className="flex items-center gap-1 text-amber-400">
              <Layers className="w-3.5 h-3.5" /> Mốc số lượng xây gộp:
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              {selectedBatch === 'MAX' ? 'Tối đa theo số Vàng' : `x${selectedBatch} Công trình`}
            </span>
          </div>

          <div className="grid grid-cols-8 gap-1">
            {batchOptions.map((opt) => (
              <button
                key={String(opt)}
                onClick={() => setSelectedBatch(opt)}
                className={`py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 flex items-center justify-center ${
                  selectedBatch === opt
                    ? 'bg-amber-500 border-amber-400 text-slate-950 font-black shadow'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
              >
                {opt === 'MAX' ? 'MAX' : `x${opt}`}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
          {buildingTypes.map((type) => {
            const info = BUILDING_INFO[type];
            const { totalCost, actualCount } = calculateBatchCost(type, selectedBatch);
            const canAfford = playerNation.gold >= totalCost;
            const isPort = type === 'PORT';
            const portValid = isPort ? selectedTile.hasHarborAccess : true;
            const isCurrentBuilding = selectedTile.building === type;

            return (
              <div
                key={type}
                className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 transition-colors ${
                  isCurrentBuilding
                    ? 'bg-blue-950/40 border-blue-500/50'
                    : 'bg-slate-800/60 border-slate-700/60'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-700 shrink-0">
                    {getIcon(type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white text-xs sm:text-sm">{info.name}</span>
                      {isCurrentBuilding && (
                        <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded-md">
                          Đã xây ở đây
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-300 truncate mt-0.5">{info.desc}</p>
                    {isPort && !portValid && (
                      <p className="text-[10px] text-amber-400 font-medium truncate">
                        ⚠️ Ô này không giáp biển
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  <div className="text-right">
                    <span className={`text-xs font-bold font-mono block ${canAfford ? 'text-amber-400' : 'text-slate-500'}`}>
                      {totalCost.toLocaleString()} Vàng
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      ({actualCount} cái)
                    </span>
                  </div>

                  <button
                    disabled={!canAfford || (!portValid && actualCount <= 1)}
                    onClick={() => {
                      onBuild(type, actualCount);
                      onClose();
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95 ${
                      canAfford && (portValid || actualCount > 1)
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Xây ({actualCount > 1 ? `x${actualCount}` : 'x1'})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
