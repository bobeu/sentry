import type { ReactNode } from "react";

type CardProps = {
  title: string;
  value: string | number;
  description?: string;
  children?: ReactNode;
};

export function Card({ title, value, description, children }: CardProps) {
  return (
    <div className="surface-card p-6 backdrop-blur">
      <p className="text-sm uppercase tracking-[0.18em] text-[#9aa89a]">{title}</p>
      <p className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[#f4f7f0]">
        {value}
      </p>
      {description ? <p className="mt-2 text-sm text-[#b7c4b5]">{description}</p> : null}
      {children}
    </div>
  );
}
