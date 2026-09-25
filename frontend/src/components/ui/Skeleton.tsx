interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

export function TableSkeleton({ rows = 8, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <tbody aria-busy="true" aria-label="Loading contacts">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border/50">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-3 py-2">
              <Skeleton className={`h-4 ${j === 0 ? 'w-40' : j === 1 ? 'w-24' : 'w-16'}`} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

export function CardSkeleton() {
  return (
    <div className="panel px-4 py-3 animate-pulse" aria-hidden="true">
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}
