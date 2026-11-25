'use client'

interface QuickLogBarChartProps {
  data: Array<{ label: string; value: number }>
  color: string
}

export function QuickLogBarChart({ data, color }: QuickLogBarChartProps) {
  const maxValue = Math.max(...data.map((entry) => Math.abs(entry.value)), 1)

  return (
    <div className="flex h-full items-end gap-1" aria-label="Recent quick log values">
      {data.map((entry, index) => {
        const height = Math.max(10, Math.round((Math.abs(entry.value) / maxValue) * 100))

        return (
          <div
            key={`${entry.label}-${entry.value}-${index}`}
            className="flex min-w-0 flex-1 items-end"
            title={`${entry.label}: ${entry.value}`}
            aria-label={`${entry.label}: ${entry.value}`}
          >
            <div
              className="w-full rounded-t-sm"
              style={{ height: `${height}%`, backgroundColor: color }}
            />
          </div>
        )
      })}
    </div>
  )
}