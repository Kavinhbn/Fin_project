import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// ─── Calibration: predicted vs observed, with the ideal diagonal ───
export function CalibrationChart({ points }: { points: { predicted: number; observed: number }[] }) {
  return (
    <div role="img" aria-label="Calibration curve: observed frequency against predicted probability" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis dataKey="predicted" type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickFormatter={(v: number) => v.toFixed(1)} label={{ value: 'Predicted', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'var(--color-text-secondary)' }} />
          <YAxis type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickFormatter={(v: number) => v.toFixed(1)} label={{ value: 'Observed', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--color-text-secondary)' }} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="var(--color-border-strong)" strokeDasharray="4 4" />
          <Tooltip contentStyle={{ background: 'var(--color-text-primary)', border: 'none', borderRadius: 999, color: 'white', fontSize: 11 }} itemStyle={{ color: 'white' }} labelStyle={{ display: 'none' }} formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))} />
          <Line type="monotone" dataKey="observed" stroke="var(--color-brand)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-brand)' }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
