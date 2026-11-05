import React, { useState } from 'react';
import { Nation, WeatherType, DarkTitan } from '../types';
import { 
  Wand2, X, Sparkles, Coins, Users, Cloud, Sun, CloudRain, 
  Zap, Skull, Flame, ShieldAlert, Check, RefreshCw, Trash2, Award
} from 'lucide-react';

interface CreativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  currentWeather: WeatherType;
  darkTitans: DarkTitan[];
  onSetGold: (amount: number) => void;
  onAddGold: (amount: number) => void;
  onSetTroops: (amount: number) => void;
  onAddTroops: (amount: number) => void;
  onChangeWeather: (weather: WeatherType) => void;
  onTriggerLightningSpam: () => void;
  onSpawnDarkTitan: (count?: number) => void;
  onClearDarkTitans: () => void;
  onUnlockAllTech: () => void;
  onClearAllScorched: () => void;
  onClaimSelectedTile?: () => void;
  selectedTileCoords?: { x: number; y: number } | null;
  godModeLocked: boolean;
  onToggleGodModeLocked: () => void;
  onTriggerCoalition?: () => void;
}

export const CreativeModal: React.FC<CreativeModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  currentWeather,
  darkTitans,
  onSetGold,
  onAddGold,
  onSetTroops,
  onAddTroops,
  onChangeWeather,
  onTriggerLightningSpam,
  onSpawnDarkTitan,
  onClearDarkTitans,
  onUnlockAllTech,
  onClearAllScorched,
  onClaimSelectedTile,
  selectedTileCoords,
  godModeLocked,
  onToggleGodModeLocked,
  onTriggerCoalition,
}) => {
  const [customGold, setCustomGold] = useState<string>('999999');
  const [customTroops, setCustomTroops] = useState<string>('50000');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[92vh] bg-slate-900 border-2 border-purple-500/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border-b border-purple-800/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-600 rounded-xl text-white shadow-lg">
              <Wand2 className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-amber-200 to-cyan-300">
                CHẾ ĐỘ SÁNG TẠO (SANDBOX)
              </h2>
              <p className="text-[10px] text-purple-300/80">Quyền năng Thần Thánh tùy biến thế giới không giới hạn</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NỘI DUNG CUỘN CHÍNH */}
        <div className="p-3 sm:p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">

          {/* 1. KHÓA BẤT TỬ / GOD MODE */}
          <div className="bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-700/50 p-2.5 rounded-2xl flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <div>
                <span className="font-bold text-white block">Khóa Bất Tử (God Mode)</span>
                <span className="text-[10px] text-slate-400">Tự động giữ 999,999 Vàng & 99,999 Quân, không hao hụt</span>
              </div>
            </div>
            <button
              onClick={onToggleGodModeLocked}
              className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1 ${
                godModeLocked 
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {godModeLocked ? <Check className="w-3.5 h-3.5" /> : null}
              {godModeLocked ? 'Đang Bật' : 'Tắt'}
            </button>
          </div>

          {/* 2. TÙY BIẾN VÀNG & QUÂN ĐỘI */}
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" /> Vàng Hiện Có: <strong className="text-white font-mono text-sm">{playerNation.gold.toLocaleString()}</strong>
              </span>
            </div>

            {/* Phím tắt cộng Vàng nhanh */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onAddGold(10000)}
                className="py-2 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/50 active:scale-95 text-amber-300 font-bold rounded-xl transition-all"
              >
                +10,000 Vàng
              </button>
              <button
                onClick={() => onAddGold(100000)}
                className="py-2 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/50 active:scale-95 text-amber-300 font-bold rounded-xl transition-all"
              >
                +100,000 Vàng
              </button>
              <button
                onClick={() => onSetGold(999999)}
                className="py-2 bg-gradient-to-r from-amber-600 to-yellow-500 active:scale-95 text-slate-950 font-extrabold rounded-xl shadow-md transition-all"
              >
                MAX (999k)
              </button>
            </div>

            {/* Nhập số vàng cụ thể */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                value={customGold}
                onChange={(e) => setCustomGold(e.target.value)}
                placeholder="Nhập số vàng..."
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold outline-none focus:border-amber-400"
              />
              <button
                onClick={() => {
                  const val = parseInt(customGold, 10);
                  if (!isNaN(val) && val >= 0) onSetGold(val);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold rounded-xl"
              >
                Đặt Vàng
              </button>
            </div>
          </div>

          {/* 3. TÙY BIẾN QUÂN LÍNH */}
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-blue-400 font-bold border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" /> Quân Số Hiện Có: <strong className="text-white font-mono text-sm">{playerNation.troops.toLocaleString()}</strong>
              </span>
            </div>

            {/* Phím tắt cộng Quân nhanh */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onAddTroops(500)}
                className="py-2 bg-blue-950/60 hover:bg-blue-900/80 border border-blue-600/50 active:scale-95 text-blue-300 font-bold rounded-xl transition-all"
              >
                +500 Quân
              </button>
              <button
                onClick={() => onAddTroops(5000)}
                className="py-2 bg-blue-950/60 hover:bg-blue-900/80 border border-blue-600/50 active:scale-95 text-blue-300 font-bold rounded-xl transition-all"
              >
                +5,000 Quân
              </button>
              <button
                onClick={() => onSetTroops(99999)}
                className="py-2 bg-gradient-to-r from-blue-600 to-cyan-500 active:scale-95 text-slate-950 font-extrabold rounded-xl shadow-md transition-all"
              >
                MAX (99k)
              </button>
            </div>

            {/* Nhập số quân cụ thể */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                value={customTroops}
                onChange={(e) => setCustomTroops(e.target.value)}
                placeholder="Nhập số quân..."
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold outline-none focus:border-blue-400"
              />
              <button
                onClick={() => {
                  const val = parseInt(customTroops, 10);
                  if (!isNaN(val) && val >= 0) onSetTroops(val);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl"
              >
                Đặt Quân
              </button>
            </div>
          </div>

          {/* 4. SPAM CÁC LOÀI THỜI TIẾT */}
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-cyan-400 font-bold border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-cyan-400" /> Spam & Đổi Thời Tiết (Hiện tại: <strong className="text-white uppercase">{currentWeather}</strong>)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onChangeWeather('CLEAR')}
                className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 border transition-all ${
                  currentWeather === 'CLEAR'
                    ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Nắng Đẹp</span>
              </button>

              <button
                onClick={() => onChangeWeather('CLOUDY')}
                className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 border transition-all ${
                  currentWeather === 'CLOUDY'
                    ? 'bg-slate-600/40 border-slate-400 text-slate-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <Cloud className="w-4 h-4 text-slate-300" />
                <span>Mây Trôi</span>
              </button>

              <button
                onClick={() => onChangeWeather('RAIN')}
                className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 border transition-all ${
                  currentWeather === 'RAIN'
                    ? 'bg-blue-600/30 border-blue-400 text-blue-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <CloudRain className="w-4 h-4 text-blue-400" />
                <span>Mưa Giông</span>
              </button>
            </div>

            {/* Spam tia chớp / sấm sét */}
            <button
              onClick={onTriggerLightningSpam}
              className="w-full py-2 bg-gradient-to-r from-amber-600/40 via-yellow-600/40 to-amber-600/40 hover:from-amber-600/60 hover:to-yellow-600/60 border border-amber-500/60 active:scale-95 text-amber-200 font-bold rounded-xl flex items-center justify-center gap-2 shadow"
            >
              <Zap className="w-4 h-4 text-yellow-400 animate-bounce" />
              <span>⚡ Spam Giông Sét Toàn Bản Đồ (5 Tia Chớp)</span>
            </button>
          </div>

          {/* 5. SPAM TÀ THẦN CỔ ĐẠI */}
          <div className="bg-slate-950/80 border border-purple-900/60 p-3 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-red-400 font-bold border-b border-purple-900/50 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Skull className="w-4 h-4 text-red-500" /> Spam Tà Thần Cổ Đại (Đang sống: <strong className="text-white font-mono text-sm">{darkTitans.length}</strong>)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSpawnDarkTitan(1)}
                className="py-2.5 bg-gradient-to-r from-red-950 to-purple-950 hover:from-red-900 hover:to-purple-900 border border-red-600/70 active:scale-95 text-red-200 font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Skull className="w-4 h-4 text-red-400" />
                <span>Triệu Hồi 1 Tà Thần</span>
              </button>

              <button
                onClick={() => onSpawnDarkTitan(3)}
                className="py-2.5 bg-gradient-to-r from-purple-900 to-red-900 hover:from-purple-800 hover:to-red-800 border border-purple-500 active:scale-95 text-purple-100 font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Flame className="w-4 h-4 text-orange-400" />
                <span>Spam 3 Tà Thần 🔥</span>
              </button>
            </div>

            {darkTitans.length > 0 && (
              <button
                onClick={onClearDarkTitans}
                className="w-full py-2 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 active:scale-95 text-slate-300 font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Dọn Sạch Toàn Bộ Tà Thần ({darkTitans.length})</span>
              </button>
            )}
          </div>

          {/* 6. TIỆN ÍCH SÁNG TẠO BỔ SUNG */}
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl space-y-2">
            <span className="font-bold text-slate-300 block border-b border-slate-800 pb-1.5">
              Quyền Năng Hỗ Trợ Nhanh
            </span>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={onUnlockAllTech}
                className="py-2 px-2 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-600/50 active:scale-95 text-indigo-300 font-bold rounded-xl flex items-center justify-center gap-1 text-center"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Mở Cây Công Nghệ</span>
              </button>

              <button
                onClick={onClearAllScorched}
                className="py-2 px-2 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-600/50 active:scale-95 text-emerald-300 font-bold rounded-xl flex items-center justify-center gap-1 text-center"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thanh Lọc Đất Cháy</span>
              </button>
            </div>

            {onTriggerCoalition && (
              <button
                onClick={onTriggerCoalition}
                className="w-full py-2 bg-gradient-to-r from-red-950/80 via-rose-950/80 to-amber-950/80 hover:from-red-900 hover:to-amber-900 border border-red-500/70 active:scale-95 text-red-200 font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-md"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>🚨 Thử Nghiệm: Kích Hoạt Liên Minh Toàn Cầu (&gt;50% Đất)</span>
              </button>
            )}

            {selectedTileCoords && onClaimSelectedTile && (
              <button
                onClick={onClaimSelectedTile}
                className="w-full py-2 bg-blue-950/60 hover:bg-blue-900/80 border border-blue-500/60 active:scale-95 text-blue-200 font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                <span>Chiếm Ngay Ô ({selectedTileCoords.x}, {selectedTileCoords.y})</span>
              </button>
            )}
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-extrabold rounded-2xl text-xs shadow-lg transition-all"
          >
            Đóng Bảng Sáng Tạo
          </button>
        </div>

      </div>
    </div>
  );
};
