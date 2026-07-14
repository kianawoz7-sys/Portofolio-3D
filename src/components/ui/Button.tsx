import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";

interface ButtonProps {
  children: ReactNode;
  className: string;
  href: string;
  target?: string;
  rel?: string;
  style?: CSSProperties;
}

export function Button({ children, className, ...props }: ButtonProps) {
  return (
    <motion.a
      className={className}
      whileHover={{ y: -2 }}
      whileTap={{ y: 0, scale: 0.985 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </motion.a>
  );
}
