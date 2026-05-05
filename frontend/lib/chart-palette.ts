export const CHART_PALETTE = [
  "#3B82F6", "#0D9488", "#E11D48", "#D97706",
  "#059669", "#EA580C", "#7C3AED", "#4F6D91",
];

export const STATUS_COLORS = {
  success: "#10B981",
  pending: "#F59E0B",
  error: "#EF4444",
  processing: "#3B82F6",
  neutral: "#94A3B8",
} as const;

export const chartColors = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)",
];

export const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "white",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    boxShadow: "var(--shadow-md)",
    fontSize: "13px",
    padding: "8px 12px",
  },
  itemStyle: { color: "var(--foreground)", fontSize: "13px" },
  labelStyle: { color: "var(--muted-foreground)", fontSize: "12px", fontWeight: 600, marginBottom: "4px" },
};

export const chartGridStyle = {
  strokeDasharray: "3 3",
  stroke: "var(--border)",
  strokeOpacity: 0.6,
};
