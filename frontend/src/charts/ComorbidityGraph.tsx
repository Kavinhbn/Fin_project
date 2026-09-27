import type { CvdPathways } from '../api/types'

// ─── ComorbidityGraph: shared risk factors -> Diabetes, Hypertension -> CVD (edge width = share) ───
export function ComorbidityGraph({ pathways }: { pathways: CvdPathways }) {
  const w = (share: number): number => 1.5 + share * 8
  return (
    <svg viewBox="0 0 520 190" role="img" aria-label="Disease cascade: shared risk factors feed diabetes and hypertension, which both feed cardiovascular disease" className="w-full max-w-[520px]">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-text-secondary)" />
        </marker>
      </defs>
      <g stroke="var(--color-border-strong)" fill="none" markerEnd="url(#arrow)">
        <path d="M130 60 L200 40" strokeWidth={1.5} />
        <path d="M130 130 L200 150" strokeWidth={1.5} />
      </g>
      <g stroke="var(--color-text-secondary)" fill="none" markerEnd="url(#arrow)">
        <path d="M330 40 L400 80" strokeWidth={w(pathways.via_diabetes)} />
        <path d="M330 150 L400 110" strokeWidth={w(pathways.via_hypertension)} />
        <path d="M130 95 L400 95" strokeWidth={w(pathways.direct)} strokeDasharray="4 4" />
      </g>
      <Node x={10} y={70} w={120} label="Shared risk factors" sub="age, BMI, lipids" />
      <Node x={200} y={15} w={130} label="Diabetes" />
      <Node x={200} y={125} w={130} label="Hypertension" />
      <Node x={400} y={70} w={110} label="CVD" />
      <text x={365} y={52} fontSize="10" fill="var(--color-text-secondary)" fontFamily="var(--font-mono)">{Math.round(pathways.via_diabetes * 100)}%</text>
      <text x={365} y={148} fontSize="10" fill="var(--color-text-secondary)" fontFamily="var(--font-mono)">{Math.round(pathways.via_hypertension * 100)}%</text>
      <text x={250} y={88} fontSize="10" fill="var(--color-text-secondary)" fontFamily="var(--font-mono)">direct {Math.round(pathways.direct * 100)}%</text>
    </svg>
  )
}

function Node({ x, y, w, label, sub }: { x: number; y: number; w: number; label: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={50} rx={8} fill="var(--color-surface)" stroke="var(--color-border-strong)" />
      <text x={x + w / 2} y={y + (sub ? 22 : 30)} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-text-primary)" fontFamily="var(--font-body)">{label}</text>
      {sub && <text x={x + w / 2} y={y + 38} textAnchor="middle" fontSize="10" fill="var(--color-text-secondary)" fontFamily="var(--font-body)">{sub}</text>}
    </g>
  )
}
