export const provinceOptions = [
  { label: "INDONESIA", value: "indonesia" },
  { label: "ACEH", value: "aceh" },
  { label: "SUMUT", value: "sumut" },
  { label: "SUMBAR", value: "sumbar" },
  { label: "RIAU", value: "riau" },
  { label: "JAMBI", value: "jambi" },
  { label: "SUMSEL", value: "sumsel" },
  { label: "BENGKULU", value: "bengkulu" },
  { label: "LAMPUNG", value: "lampung" },
  { label: "DKI", value: "dki" },
  { label: "JABAR", value: "jabar" },
  { label: "JATENG", value: "jateng" },
  { label: "DIY", value: "diy" },
  { label: "JATIM", value: "jatim" },
  { label: "BANTEN", value: "banten" },
  { label: "BALI", value: "bali" },
  { label: "NTB", value: "ntb" },
  { label: "NTT", value: "ntt" },
  { label: "KALBAR", value: "kalbar" },
  { label: "KALTENG", value: "kalteng" },
  { label: "KALSEL", value: "kalsel" },
  { label: "KALTIM", value: "kaltim" },
  { label: "SULUT", value: "sulut" },
  { label: "SULTENG", value: "sulteng" },
  { label: "SULSEL", value: "sulsel" },
  { label: "SULTRA", value: "sultra" },
  { label: "GORONTALO", value: "gorontalo" },
  { label: "MALUKU", value: "maluku" },
  { label: "PAPUA", value: "papua" },
];

export const rangeButtons = [
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "8Y", value: "8Y" },
];

export const FILTER_OPTIONS = {
  measure: [
    { label: "Nilai", value: "nilai" },
    { label: "Pertumbuhan", value: "pertumbuhan" },
  ],
  monthlyMethods: [
    { label: "M to M", value: "mtom" },
    { label: "Y on Y", value: "yony" },
    { label: "Y to D", value: "ytod" },
  ],
  quarterlyMethods: [
    { label: "Q to Q", value: "qtoq" },
    { label: "Y on Y", value: "yony" },
    { label: "C to C", value: "ctoc" },
  ],
  staticPeriod: [
    { label: "Triwulanan", value: "quarterly" },
    { label: "Tahunan", value: "yearly" },
  ],
  staticQuarterlyMethods: [
    { label: "Q to Q", value: "qtoq" },
    { label: "Y on Y", value: "yony" },
    { label: "C to C", value: "ctoc" },
  ],
  chartTypes: [
    { label: "Line Chart", value: "line" },
    { label: "Bar Chart", value: "bar" },
  ],
  combineBarModes: [
    { label: "Mode Standar", value: "standard" },
    { label: "Mode Stack Bar", value: "stack" },
  ],
};

export const LOADING_STAGES = [
  {
    title: "Mengambil data...",
    subtitle: "Menghubungkan komponen dengan sumber data",
  },
  {
    title: "Menyusun grafik...",
    subtitle: "Menyiapkan tampilan chart dinamis dan statis",
  },
  {
    title: "Merapikan tampilan...",
    subtitle: "Menyelaraskan filter, card, dan visual akhir",
  },
];

export const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const palette = [
  { line: "#3B82F6", fill: "rgba(59,130,246,0.45)" },
  { line: "#F59E0B", fill: "rgba(245,158,11,0.45)" },
  { line: "#A855F7", fill: "rgba(168,85,247,0.45)" },
  { line: "#22C55E", fill: "rgba(34,197,94,0.45)" },
  { line: "#EF4444", fill: "rgba(239,68,68,0.45)" },
];

export const DATASET_COLOR_FAMILIES = [
  ["#DC2626", "#EF4444", "#F87171", "#FCA5A5", "#FECACA"],
  ["#CA8A04", "#EAB308", "#FACC15", "#FDE047", "#FEF9C3"],
  ["#16A34A", "#22C55E", "#4ADE80", "#86EFAC", "#BBF7D0"],
  ["#1E3A8A", "#2563EB", "#3B82F6", "#93C5FD", "#DBEAFE"],
  ["#6B21A8", "#7C3AED", "#8B5CF6", "#C4B5FD", "#EDE9FE"],
];

export const TOTAL_BAR_COLOR = {
  line: "#14B8A6",
  fill: "rgba(20, 184, 166, 0.35)",
};