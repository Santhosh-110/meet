import { useMemo } from 'react'

interface VideoGridProps {
  children: React.ReactNode[]
}

export function VideoGrid({ children }: VideoGridProps) {
  const layout = useMemo(() => {
    const count = children.length
    
    if (count === 1) {
      return {
        columns: 1,
        maxWidth: '800px',
        maxHeight: '100%',
      }
    }
    
    if (count === 2) {
      return {
        columns: 2,
        maxWidth: '100%',
        maxHeight: '100%',
      }
    }
    
    if (count <= 4) {
      return {
        columns: 2,
        maxWidth: '100%',
        maxHeight: '100%',
      }
    }
    
    if (count <= 9) {
      return {
        columns: 3,
        maxWidth: '100%',
        maxHeight: '100%',
      }
    }
    
    return {
      columns: Math.min(4, Math.ceil(Math.sqrt(count))),
      maxWidth: '100%',
      maxHeight: '100%',
    }
  }, [children.length])

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div 
        className="grid gap-3 w-full h-full max-w-[1200px]"
        style={{ 
          gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
          gridAutoRows: 'minmax(0, 1fr)',
        }}
      >
        {children}
      </div>
    </div>
  )
}