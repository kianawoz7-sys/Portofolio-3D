import { motion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";

export function MagneticImage(props: HTMLMotionProps<"img">) {
  return <motion.img {...props} />;
}
