'use client';

import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

interface ClickableRowProps {
  href?: string;
  children: ReactNode;
  className?: string;
}

export function ClickableRow({ href, children, className = '' }: ClickableRowProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    }
  };

  return (
    <tr
      onClick={handleClick}
      className={className}
      style={href ? { cursor: 'pointer' } : undefined}
    >
      {children}
    </tr>
  );
}
