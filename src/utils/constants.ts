import { TechNode, BuildingType } from '../types';

export const TILE_PIXEL_SIZE = 24; // Kích thước ô chuẩn 24px

export const TECH_TREE: TechNode[] = [
  {
    id: 'eco_1',
    branch: 'ECONOMY',
    level: 1,
    name: 'Khai Khẩn Điền Trang',
    description: 'Tăng 8% sản lượng vàng từ đất đai và thành thị.',
    cost: 150,
    researchTime: 10,
  },
  {
    id: 'eco_2',
    branch: 'ECONOMY',
    level: 2,
    name: 'Phường Buôn Phồn Hoa',
    description: 'Tăng 15% thu nhập vàng và giảm 8% chi phí xây dựng.',
    cost: 300,
    researchTime: 18,
  },
  {
    id: 'eco_3',
    branch: 'ECONOMY',
    level: 3,
    name: 'Đế Quốc Hoàng Kim',
    description: 'Tăng 25% thu nhập vàng, cộng thêm 20 vàng khi chiếm đất địch.',
    cost: 500,
    researchTime: 25,
  },
  {
    id: 'mil_1',
    branch: 'MILITARY',
    level: 1,
    name: 'Lò Rèn Kiếm Thép',
    description: 'Tăng 10% tốc độ sinh quân và tốc độ hành quân.',
    cost: 150,
    researchTime: 10,
  },
  {
    id: 'mil_2',
    branch: 'MILITARY',
    level: 2,
    name: 'Kỵ Binh Giáp Nặng',
    description: 'Tăng 15% sát thương tiến công, tăng +30 giới hạn quân tối đa.',
    cost: 300,
    researchTime: 18,
  },
  {
    id: 'mil_3',
    branch: 'MILITARY',
    level: 3,
    name: 'Quân Đoàn Vô Song',
    description: 'Giảm 20% sức phòng thủ của kẻ địch ở ô địa hình Núi.',
    cost: 500,
    researchTime: 25,
  },
  {
    id: 'def_1',
    branch: 'DEFENSE',
    level: 1,
    name: 'Hào Sâu Cọc Nhọn',
    description: 'Tăng 10% sức phòng thủ cho toàn bộ biên giới lãnh thổ.',
    cost: 150,
    researchTime: 10,
  },
  {
    id: 'def_2',
    branch: 'DEFENSE',
    level: 2,
    name: 'Tường Đá Hoa Cương',
    description: 'Tăng 18% sức phòng thủ biên giới và giảm sát thương.',
    cost: 300,
    researchTime: 18,
  },
  {
    id: 'def_3',
    branch: 'DEFENSE',
    level: 3,
    name: 'Vạn Lý Trường Thành',
    description: 'Tăng 25% sức phòng thủ tổng thể khi kẻ địch tiến công.',
    cost: 500,
    researchTime: 25,
  },
];

export const REAL_NATION_NAMES: string[] = [
  "Việt Nam", "Nhật Bản", "Hàn Quốc", "Trung Quốc", "Hoa Kỳ", "Anh Quốc", "Pháp", "Đức", "Ý", "Tây Ban Nha",
  "Bồ Đào Nha", "Nga", "Brazil", "Argentina", "Úc", "Ấn Độ", "Thái Lan", "Singapore", "Indonesia", "Malaysia",
  "Thụy Sĩ", "Hà Lan", "Bỉ", "Thụy Điển", "Na Uy", "Đan Mạch", "Phần Lan", "Ai Cập", "Nam Phi", "Canada",
  "Mexico", "Colombia", "Chile", "Peru", "Hy Lạp", "Thổ Nhĩ Kỳ", "Ả Rập Xê Út", "UAE", "Qatar", "Iran",
  "Iraq", "Israel", "Áo", "Ba Lan", "Hung-ga-ri", "Tiệp Khắc", "Romania", "Bulgaria", "Serbia", "Croatia",
  "Slovenia", "Slovakia", "Ukraine", "Belarus", "Kazakhstan", "Uzbekistan", "Mông Cổ", "Nepal", "Sri Lanka", "Bangladesh",
  "Myanmar", "Lào", "Campuchia", "Philippines", "Brunei", "New Zealand", "Fiji", "Cuba", "Jamaica", "Panama",
  "Costa Rica", "Uruguay", "Paraguay", "Bolivia", "Ecuador", "Venezuela", "Kenya", "Nigeria", "Ghana", "Ethiopia",
  "Ma-rốc", "Algeria", "Tunisia", "Zimbabwe", "Senegal", "Bờ Biển Ngà", "Cameroon", "Tanzania", "Madagascar", "Mozambique",
  "Angola", "Zambia", "Uganda", "Rwanda", "Jordan", "Liban", "Oman", "Kuwait", "Bahrain", "Armenia",
  "Georgia", "Azerbaijan", "Ireland", "Iceland", "Luxembourg", "Monaco", "Liechtenstein", "Malta", "Síp", "Estonia",
  "Latvia", "Lithuania", "Moldova", "Albania", "Bắc Macedonia", "Montenegro", "Bosnia", "Kosovo", "San Marino", "Vatican",
  "Andorra", "Micronesia", "Palau", "Samoa", "Tonga", "Vanuatu", "Quần đảo Solomon", "Tuvalu", "Kiribati", "Quần đảo Marshall",
  "Nauru", "Papua New Guinea", "Đông Timor", "Maldives", "Bhutan", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Seychelles", "Mauritius",
  "Cape Verde", "Sao Tome & Principe", "Comoros", "Djibouti", "Eritrea", "Somalia", "Sudan", "Nam Sudan", "Chad", "Niger",
  "Mali", "Mauritania", "Gambia", "Guinea", "Guinea-Bissau", "Sierra Leone", "Liberia", "Burkina Faso", "Togo", "Benin",
  "Cộng hòa Trung Phi", "Xích Đạo Guinea", "Gabon", "Cộng hòa Congo", "Cộng hòa Dân chủ Congo", "Burundi", "Malawi", "Eswatini", "Lesotho", "Namibia",
  "Botswana", "Suriname", "Guyana", "Bahamas", "Barbados", "Trinidad & Tobago", "Dominica", "Saint Lucia", "Grenada", "Saint Vincent",
  "Antigua & Barbuda", "Saint Kitts & Nevis", "Belize", "Guatemala", "El Salvador", "Honduras", "Nicaragua", "Dominicana", "Haiti", "Bermuda"
];

export function formatPopulation(num: number): string {
  if (num <= 0) return '0';
  if (num < 1000) return `${num}`;
  if (num < 1_000_000) {
    const k = (num / 1000).toFixed(1).replace(/\.0$/, '');
    return `${k}K`;
  }
  const m = (num / 1_000_000).toFixed(1).replace(/\.0$/, '');
  return `${m}M`;
}

export const BUILDING_INFO: Record<Exclude<BuildingType, 'NONE'>, {
  name: string;
  desc: string;
  baseCost: number;
  icon: string;
}> = {
  CITY: {
    name: 'Thành Thị',
    desc: 'Tăng mạnh thu nhập vàng và +40 trần dân số. Hỗ trợ xây chồng nâng cấp!',
    baseCost: 120,
    icon: 'Building2',
  },
  BARRACKS: {
    name: 'Doanh Trại',
    desc: 'Tăng tốc độ sinh quân và +80 trần dân số. Hỗ trợ xây chồng nâng cấp!',
    baseCost: 140,
    icon: 'Swords',
  },
  FORTRESS: {
    name: 'Pháo Đài',
    desc: 'Tăng 2.5x phòng thủ. Xây chồng để tăng thêm cấp phòng thủ vững chắc!',
    baseCost: 90,
    icon: 'Shield',
  },
  PORT: {
    name: 'Hải Cảng',
    desc: 'Xây ven biển để quân đội vượt biển đổ bộ. Hỗ trợ xây chồng tăng thu nhập!',
    baseCost: 160,
    icon: 'Anchor',
  },
  ARTILLERY: {
    name: 'Đại Pháo',
    desc: 'Bắn plasma mỗi 15s. Xây chồng tăng sát thương & cự ly nã pháo!',
    baseCost: 180,
    icon: 'Crosshair',
  },
  MISSILE_SILO: {
    name: 'Bệ Tên Lửa',
    desc: 'Bắn tên lửa chiến thuật tầm xa tàn phá quân địch và vùng đất trong phạm vi lớn!',
    baseCost: 260,
    icon: 'Rocket',
  },
  AIR_DEFENSE: {
    name: 'Trạm Phòng Không',
    desc: 'Đánh chặn đợt quân tiến công & vô hiệu hóa pháo kích địch trong tầm ảnh hưởng!',
    baseCost: 210,
    icon: 'ShieldAlert',
  },
};

/**
 * Cấu hình Tà Thần Cổ Đại (Lấy cảm hứng Tà Thần phút 15 Liên Quân Mobile)
 * Dễ dàng tùy chỉnh các thông số tại đây!
 */
export const DARK_TITAN_CONFIG = {
  // Thời điểm xuất hiện (giây): 900s = phút thứ 15.
  SPAWN_TIME_SECONDS: 900,
  // Thời gian tồn tại: 300s = 5 phút
  DURATION_SECONDS: 300,
  // Báo trước khi biến mất: 30s
  WARNING_BEFORE_DESPAWN: 30,
  // Tốc độ di chuyển: Cứ mỗi 8 giây di chuyển 1 ô
  MOVE_INTERVAL_SECONDS: 8,
  // Sát thương quân đội: Giảm 25 quân của quốc gia ở ô nó đi qua
  DAMAGE_TROOPS: 25,
  // Lượng Máu khủng của Tà Thần: 1200 HP
  MAX_HP: 1200,
  // Thưởng Vàng hậu lĩnh khi đánh gục Tà Thần: 2,000 Vàng
  BOUNTY_GOLD: 2000,
  // Thời gian nhận Buff sức mạnh +30%: 180s = 3 phút
  BUFF_DURATION_SECONDS: 180,
};

export function formatGameTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

