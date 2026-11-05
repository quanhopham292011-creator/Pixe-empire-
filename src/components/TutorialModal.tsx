import React from 'react';
import { Swords, Building2, Crown, X, Check } from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <h3 className="font-bold text-white text-base">Hướng Dẫn Chiến Thuật 3 Bước</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          <div className="flex gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
            <div className="p-2.5 bg-blue-950 text-blue-400 rounded-lg h-fit border border-blue-800/50">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">1. Tiến Quân Tràn Biên Giới</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Chạm vào ô đất địch hoặc ô trung lập nằm sát biên giới của bạn. Kéo thanh trượt % để điều động số lượng quân tiến công. Núi phòng thủ gấp đôi, Rừng làm chậm tốc độ.
              </p>
            </div>
          </div>

          <div className="flex gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
            <div className="p-2.5 bg-amber-950 text-amber-400 rounded-lg h-fit border border-amber-800/50">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">2. Xây Thành Trì & Công Nghệ</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Dùng Vàng xây <strong>Thành Thị</strong> (+vàng), <strong>Doanh Trại</strong> (+quân), <strong>Pháo Đài</strong> (tăng thủ) và <strong>Hải Cảng</strong> ven biển để quân đội có thể vượt biển đổ bộ sang các hòn đảo khác!
              </p>
            </div>
          </div>

          <div className="flex gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
            <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-lg h-fit border border-emerald-800/50">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">3. Ngoại Giao & Thống Nhất</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Đình chiến hoặc Liên minh với các Bot khi gặp bất lợi. Đạt mốc <strong>chiếm 70% đất liền</strong> hoặc là quốc gia duy nhất còn tồn tại để giành chiến thắng tối hậu!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
          >
            <Check className="w-4 h-4" />
            Đã Hiểu, Vào Trận Ngay!
          </button>
        </div>
      </div>
    </div>
  );
};
