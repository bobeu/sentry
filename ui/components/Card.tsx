import type { ReactNode } from "react";

type CardProps = {
  title: string;
  value: string | number;
  description?: string;
  children?: ReactNode;
};

export function Card({ title, value, description, children }: CardProps) {
  return (
    <div className="surface-card p-6 border border-primary/10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{title}</p>
      <p className="mt-3 font-sans text-2xl font-black text-text-dark">
        {value}
      </p>
      {description ? <p className="mt-2 text-xs font-semibold text-muted">{description}</p> : null}
      {children}
    </div>
  );
}
