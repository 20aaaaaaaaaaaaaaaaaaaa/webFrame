import { cn } from '@/shared/ui/cn';

interface WebFrameLogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: {
    icon: 'w-5 h-5',
    text: 'text-base',
    gap: 'gap-1.5',
  },
  md: {
    icon: 'w-7 h-7',
    text: 'text-xl',
    gap: 'gap-2',
  },
  lg: {
    icon: 'w-10 h-10',
    text: 'text-3xl',
    gap: 'gap-3',
  },
};

function FrameIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <line x1="2" y1="8" x2="22" y2="8" />
      <line x1="8" y1="2" x2="8" y2="22" />
    </svg>
  );
}

/** @deprecated Use WebFrameLogo instead */
export const WebFrameLogo = WebFrameLogo;

export function WebFrameLogo({ variant = 'full', size = 'md', className }: WebFrameLogoProps) {
  const config = sizeConfig[size];

  if (variant === 'icon') {
    return <FrameIcon className={cn(config.icon, 'text-primary', className)} />;
  }

  return (
    <div className={cn('flex items-center', config.gap, className)}>
      <FrameIcon className={cn(config.icon, 'text-primary')} />
      <span
        className={cn(
          config.text,
          'font-semibold tracking-tight text-foreground'
        )}
      >
        webFrame
      </span>
    </div>
  );
}
