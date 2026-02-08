import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassPanelProps {
  children: ReactNode;
  variant?: 'default' | 'heavy';
  className?: string;
}

export default function GlassPanel({
  children,
  variant = 'default',
  className,
}: GlassPanelProps) {
  const baseClass = variant === 'heavy' ? 'glass-panel-heavy' : 'glass-panel';

  return <div className={cn(baseClass, className)}>{children}</div>;
}
