'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AuditCTAProps {
  children?: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export default function AuditCTA({ children, className = '', variant = 'primary' }: AuditCTAProps) {
  const pathname = usePathname();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    // If we're already on the homepage, just scroll
    if (pathname === '/') {
      const element = document.getElementById('run-audit');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus the input field after scroll
        setTimeout(() => {
          const input = element.querySelector('input');
          if (input) input.focus();
        }, 500);
      }
    } else {
      // Navigate to homepage with hash
      window.location.href = '/#run-audit';
    }
  };

  const baseClasses = variant === 'primary'
    ? 'inline-block px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-semibold rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-yellow-400/20'
    : 'inline-block px-8 py-4 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-slate-100 font-semibold rounded-lg transition-all duration-200';

  return (
    <Link
      href="/#run-audit"
      onClick={handleClick}
      className={`${baseClasses} ${className}`}
    >
      {children || 'Run Free Audit'}
    </Link>
  );
}
