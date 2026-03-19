import type { ReactNode } from 'react';

type SectionTitleProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function SectionTitle({ title, description, action }: SectionTitleProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {description ? <p className="max-w-2xl text-sm text-slate-600">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
