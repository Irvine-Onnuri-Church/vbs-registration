import type { ReactNode } from 'react';

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export default function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`page-container py-10 ${className}`.trim()}>
      {children}
    </div>
  );
}
