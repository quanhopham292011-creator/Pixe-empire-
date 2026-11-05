import React from 'react';
import { BuildingType, Tile, Nation } from '../types';
import { BUILDING_INFO } from '../utils/constants';
import { Building2, Swords, Shield, Anchor, X, Check } from 'lucide-react';

interface BuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTile: Tile | null;
  playerNation: Nation;
  existingBuildingCounts: Record<BuildingType, number>;
  onBuild: (type: BuildingType) => void;
}

export const BuildModal: React.FC<BuildModalProps> = ({
  isOpen,
  onClose,
  selectedTile,
  playerNation,
  existingBuildingCounts,
  onBuild,
}) => {
  if (!isOpen || !selectedTile) return null;

  const getCost = (type: Exclude<BuildingType, 'NONE'>) => {
    const base = BUILDING_INFO[type].baseCost;
    const count = existingBuildingCounts[type] || 0;
    const discount = playerNation.techLevels.economy >= 2 ? 0.85 : 1.0;
    return Math.floor(base * Math.pow(1.15, count) * discount);
  };

  const buildingTypes: Array<Exclude<BuildingType, 'NONE'>> = ['CITY', 'BARRACKS', 'FORTRESS', 'PORT'];

  const getIcon = (type: BuildingType) => {
    switch (type) {
      case 'CITY': return <Building2 className="w-5 h-5 text-amber-400" />;
      case 'BARRACKS': return <Swords className="w-5 h-5 text-red-400" />;
      case 'FORTRESS': return <Shield className="w-5 h-5 text-blue-400" />;
      case 'PORT': return <Anchor className="w-5 h-5 text-cyan-400" />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">Xây Dựng Thành Trì</h3>
              <span className="text-xs bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 px-2 py-0.5 rounded-full">
                💰 {playerNation.gold} Vàng
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Vị trí ({selectedTile.x}, {selectedTile.y}) · {selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng' : 'Núi'} {selectedTile.hasHarborAccess ? '· Giáp biển' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {buildingTypes.map((type) => {
            const info = BUILDING_INFO[type];
            const cost = getCost(type);
            const canAfford = playerNation.gold >= cost;
            const isPort = type === 'PORT';
            const portValid = isPort ? selectedTile.hasHarborAccess : true;
            const isCurrentBuilding = selectedTile.building === type;

            return (
              <div
                key={type}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                  isCurrentBuilding
                    ? 'bg-blue-950/40 border-blue-500/50'
                    : 'bg-slate-800/60 border-slate-700/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-700 shrink-0">
                    {getIcon(type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{info.name}</span>
                      {isCurrentBuilding && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded">
                          Đã xây
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">{info.desc}</p>
                    {isPort && !portValid && (
                      <p className="text-[11px] text-amber-400 mt-1 font-medium">
                        ⚠️ Cảng chỉ được xây trên ô đất tiếp giáp mặt biển!
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold ${canAfford ? 'text-amber-400' : 'text-slate-500'}`}>
                    {cost} Vàng
                  </span>
                  <button
                    disabled={!canAfford || !portValid || isCurrentBuilding}
                    onClick={() => {
                      onBuild(type);
                      onClose();
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 ${
                      canAfford && portValid && !isCurrentBuilding
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Xây
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
