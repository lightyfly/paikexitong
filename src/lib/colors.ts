export const MODERN_COLORS: string[] = [
  '#0ea5e9', // sky
  '#14b8a6', // teal
  '#22c55e', // green
  '#84cc16', // lime
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // purple
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#e11d48', // rose
]

export function pickCourseColor(index: number) {
  return MODERN_COLORS[index % MODERN_COLORS.length]
}
