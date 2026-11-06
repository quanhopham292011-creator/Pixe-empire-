import React from 'react';
import { Nation } from '../types';
import { Trophy, Crown, Medal, Flag } from 'lucide-react';

interface MatchLeaderboardProps {
  nations: Record<number, Nation> | undefined;
  myNationId: number;
  totalLand: number;
  isVictory?: boolean;
}

export const MatchLeaderboard: React.FC<MatchLeaderboardProps> = ({
  nations,
  myNationId,
  totalLand,
  isVictory = false,
}) => {
  const nationsList = Object.values(nations || {}).filter(
    (n): n is Nation => !!n && typeof n.id === 'number' && n.id > 0
  );

  // Sắp xếp các quốc gia theo số ô lãnh thổ giảm dần
  const sortedNations = [...nationsList].sort((a, b) => {
    const diff = (b.territoryCount || 0) - (a.territoryCount || 0);
    if (diff !== 0) return diff;
    return (b.troops || 0) - (a.troops || 0);
  });

  const safeTotalLand = Math.max(1, totalLand);
  const myRankIndex = sortedNations.findIndex(n => n.id === myNationId);
  const myNation = sortedNations[myRankIndex];

  return (
    <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-4 my-4 text-left shadow-inner">
      {/* TIÊU ĐỀ BẢNG XẾP HẠNG */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Trophy className={`w-4 h-4 ${isVictory ? 'text-amber-400' : 'text-blue-400'}`} />
          <span className="text-xs sm:text-sm font-black text-slate-100 tracking-wide uppercase">
            Bảng Xếp Hạng Lãnh Thổ
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          Tổng {safeTotalLand.toLocaleString()} ô đất
        </span>
      </div>

      {/* THẺ TÓM TẮT THỨ HẠNG CỦA NGƯỜI CHƠI */}
      {myNation && (
        <div
          className={`mb-2.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between ${
            myRankIndex === 0
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {myRankIndex === 0 ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <Medal className="w-3.5 h-3.5 text-blue-400" />}
            Thứ hạng của bạn:
          </span>
          <span className="font-mono font-black">
            #{myRankIndex + 1} / {sortedNations.length} ({myNation.territoryCount || 0} ô - {Math.round(((myNation.territoryCount || 0) / safeTotalLand) * 100)}%)
          </span>
        </div>
      )}

      {/* DANH SÁCH CHI TIẾT CÁC QUỐC GIA (CUỘN ĐƯỢC TRÊN ĐIỆN THOẠI) */}
      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 touch-pan-y">
        {sortedNations.map((nation, idx) => {
          const isMe = nation.id === myNationId;
          const territory = nation.territoryCount || 0;
          const percent = Math.min(100, Math.round((territory / safeTotalLand) * 100));
          const isEliminated = nation.isEliminated || territory === 0;

          // Huy hiệu thứ hạng
          let rankBadge = (
            <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-mono font-bold flex items-center justify-center">
              #{idx + 1}
            </span>
          );

          if (idx === 0) {
            rankBadge = (
              <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black flex items-center justify-center">
                🥇
              </span>
            );
          } else if (idx === 1) {
            rankBadge = (
              <span className="w-5 h-5 rounded-md bg-slate-300/20 text-slate-200 border border-slate-300/40 text-[10px] font-black flex items-center justify-center">
                🥈
              </span>
            );
          } else if (idx === 2) {
            rankBadge = (
              <span className="w-5 h-5 rounded-md bg-amber-700/20 text-amber-500 border border-amber-700/40 text-[10px] font-black flex items-center justify-center">
                🥉
              </span>
            );
          }

          return (
            <div
              key={nation.id}
              className={`p-2 rounded-xl transition-all ${
                isMe
                  ? 'bg-slate-800/90 border border-amber-500/50 shadow-sm'
                  : 'bg-slate-900/60 border border-slate-800/80'
              } ${isEliminated && !isMe ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                {/* HẠNG & TÊN QUỐC GIA */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {rankBadge}
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs"
                    style={{ backgroundColor: nation.color || '#94a3b8' }}
                  />
                  <span className={`text-xs truncate font-bold ${isMe ? 'text-amber-300' : 'text-slate-200'}`}>
                    {nation.name}
                  </span>
                  {isMe && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-0.2 rounded font-black flex-shrink-0">
                      BẠN
                    </span>
                  )}
                  {isEliminated && (
                    <span className="text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1 py-0.2 rounded font-semibold flex-shrink-0">
                      Thất thủ
                    </span>
                  )}
                </div>

                {/* SỐ Ô LÃNH THỔ & TỶ LỆ % */}
                <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
                  <span className="text-xs font-mono font-bold text-slate-100">
                    {territory.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">ô</span>
                  </span>
                  <span className="text-[10px] font-mono font-black text-amber-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                    {percent}%
                  </span>
                </div>
              </div>

              {/* THANH TIẾN ĐỘ THỂ HIỆN % LÃNH THỔ TRÊN BẢN ĐỒ */}
              <div className="w-full bg-slate-950/80 rounded-full h-1.5 overflow-hidden mt-1.5 border border-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(2, percent)}%`,
                    backgroundColor: nation.color || '#3b82f6',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
