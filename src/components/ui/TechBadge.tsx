import { motion } from "motion/react";
import type React from "react";

import { easePremium } from "../../lib/animation";

interface TechBadgeProps {
  tech: string;
  key?: React.Key;
}

export function TechBadge({ tech }: TechBadgeProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24, scale: 0.94 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: easePremium } },
      }}
      whileHover={{ y: -4, backgroundColor: "var(--color-surface-container)", boxShadow: "0px 10px 30px rgba(0,0,0,0.03)" }}
      className="px-8 py-4 ghost-border rounded-full font-label-caps text-label-caps text-primary bg-surface transition-all duration-300 cursor-default"
    >
      {tech}
    </motion.div>
  );
}
