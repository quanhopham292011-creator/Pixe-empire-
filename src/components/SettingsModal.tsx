import React, { useState } from 'react';
import { Volume2, VolumeX, Pause, Play, Map, LogOut, X, AlertTriangle, Settings, Cloud, CloudRain, Sun } from 'lucide-react';
import { WeatherType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
  weatherEnabled: boolean;
  onToggleWeather: () => void;
  weather: WeatherType;
  onCycleWeather: () => void;
  onQuitToTitle: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
  onToggleSound,
  isPaused,
  onTogglePause,
  showMinimap,
  onToggleMinimap,
  weatherEnabled,
  onToggleWeather,
  weather,
  onCycleWeather,
  onQuitToTitle,
}) => {
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Settings className="w-5 h-5 animate-spin-slow" />
            <h3 className="font-extrabold text-base text-white">CÀI ĐẶT TRẬN ĐẤU</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nội dung xác nhận thoát trận */}
        {showQuitConfirm ? (
          <div className="bg-red-950/40 border border-red-500/40 rounded-2xl p-4 text-center space-y-3 animate-in zoom-in-95 duration-150">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto animate-bounce" />
            <h4 className="font-bold text-sm text-red-200">XÁC NHẬN THOÁT TRẬN?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn rời khỏi trận đấu? Tiến trình hiện tại sẽ bị hủy.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowQuitConfirm(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  setShowQuitConfirm(false);
                  onClose();
                  onQuitToTitle();
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg"
              >
                Xác Nhận Thoát
              </button>
            </div>
          </div>
        ) : (
          /* Cài đặt chính */
          <div className="space-y-3">
            {/* 1. Âm thanh */}
            <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2.5">
                {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                <div>
                  <div className="text-xs font-bold text-slate-200">Âm Thanh Game</div>
                  <div className="text-[10px] text-slate-400">Hiệu ứng chiến đấu & âm báo</div>
                </div>
              </div>
              <button
                onClick={onToggleSound}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  soundEnabled
                    ? 'bg-emerald-600/90 border-emerald-400 text-white shadow'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {soundEnabled ? 'BẬT' : 'TẮT'}
              </button>
            </div>

            {/* 2. Tạm dừng trận đấu */}
            <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2.5">
                {isPaused ? <Play className="w-4 h-4 text-amber-400" /> : <Pause className="w-4 h-4 text-blue-400" />}
                <div>
                  <div className="text-xs font-bold text-slate-200">Trạng Thái Trận Đấu</div>
                  <div className="text-[10px] text-slate-400">{isPaused ? 'Đang tạm dừng' : 'Đang diễn ra bình thường'}</div>
                </div>
              </div>
              <button
                onClick={onTogglePause}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  isPaused
                    ? 'bg-amber-600/90 border-amber-400 text-white shadow'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {isPaused ? 'TIẾP TỤC' : 'TẠM DƯNG'}
              </button>
            </div>

            {/* 3. Hiển thị Mini Map */}
            <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2.5">
                <Map className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-xs font-bold text-slate-200">Hiển Thị Bản Đồ Nhỏ</div>
                  <div className="text-[10px] text-slate-400">Minimap ở góc trên màn hình</div>
                </div>
              </div>
              <button
                onClick={onToggleMinimap}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  showMinimap
                    ? 'bg-cyan-600/90 border-cyan-400 text-slate-950 shadow'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {showMinimap ? 'HIỆN' : 'ẨN'}
              </button>
            </div>

            {/* 4. Hiệu ứng Thời tiết (Mây trôi / Mưa) */}
            <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2.5">
                {weather === 'RAIN' ? (
                  <CloudRain className="w-4 h-4 text-sky-400" />
                ) : weather === 'CLOUDY' ? (
                  <Cloud className="w-4 h-4 text-indigo-300" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-200">Hiệu Ứng Thời Tiết</div>
                  <div className="text-[10px] text-slate-400">
                    {weather === 'RAIN' ? 'Mưa lất phất' : weather === 'CLOUDY' ? 'Mây trôi bồng bềnh' : 'Nắng nhẹ'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {weatherEnabled && (
                  <button
                    onClick={onCycleWeather}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    Đổi kiểu
                  </button>
                )}
                <button
                  onClick={onToggleWeather}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    weatherEnabled
                      ? 'bg-sky-600/90 border-sky-400 text-white shadow'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {weatherEnabled ? 'BẬT' : 'TẮT'}
                </button>
              </div>
            </div>

            {/* 5. Nút Thoát trận */}
            <button
              onClick={() => setShowQuitConfirm(true)}
              className="w-full py-3 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 mt-2"
            >
              <LogOut className="w-4 h-4" />
              THOÁT TRẬN ĐẤU
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
