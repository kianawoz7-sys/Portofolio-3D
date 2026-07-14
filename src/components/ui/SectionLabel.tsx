import type { CSSProperties, ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
  className: string;
  style?: CSSProperties;
}

export function SectionLabel({ children, className, style }: SectionLabelProps) {
  return (
    <span className={className} style={style}>
      {children}
    </span>
  );
}
