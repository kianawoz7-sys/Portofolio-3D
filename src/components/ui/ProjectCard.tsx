import { useRef } from "react";
import type React from "react";
import { motion, useScroll, useTransform } from "motion/react";

import type { Project } from "../../data/projects";
import { resolveProjectComposition } from "../../data/projects";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

interface ProjectCardProps {
  project: Project;
  index: number;
  key?: React.Key;
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: cardRef, offset: ["start end", "center center"] });

  const cardY = useTransform(scrollYProgress, [0, 1], reducedMotion ? ["0px", "0px"] : ["60px", "0px"]);
  const cardOpacity = useTransform(scrollYProgress, [0, 0.4], reducedMotion ? [1, 1] : [0, 1]);
  const cardScale = useTransform(scrollYProgress, [0, 1], reducedMotion ? [1, 1] : [0.96, 1]);
  const reverse = resolveProjectComposition(project, index) === "right";

  return (
    <motion.article
      ref={cardRef}
      style={{ y: cardY, opacity: cardOpacity, scale: cardScale }}
      className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center group"
    >
      <div className={`md:col-span-7 ${reverse ? "md:col-start-6 order-1 md:order-2" : "md:col-start-1 order-2 md:order-1"}`}>
        <motion.div
          whileHover={{ y: -5, boxShadow: "0px 20px 50px rgba(0, 0, 0, 0.05)" }}
          className="bg-surface-container-low aspect-[4/3] w-full relative ghost-border overflow-hidden p-12 md:p-20 transition-all duration-500 ease-out"
        >
          <motion.img
            whileHover={{ scale: 1.04 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full h-full object-contain bg-[#05070a] long-shadow"
            alt={project.imageAlt}
            src={project.imagePath}
          />
        </motion.div>
      </div>

      <motion.div
        className={`md:col-span-4 ${reverse ? "md:col-start-1 order-2 md:order-1" : "md:col-start-9 order-1 md:order-2"} flex flex-col items-start pb-12 md:pb-0`}
      >
        <span className="font-label-caps text-label-caps text-on-surface-variant mb-6 tracking-[0.2em]">
          {project.category}
        </span>
        <h3 className="font-headline-md text-[48px] md:text-[56px] text-primary mb-6 leading-tight">
          {project.title}
        </h3>
        <p className="font-body-md text-[18px] text-on-surface-variant mb-10 leading-relaxed">{project.description}</p>
        <div className="flex flex-wrap gap-3 mb-12">
          {project.technologyStack.map((tag) => (
            <span key={tag} className="text-xs font-label-caps text-on-surface-variant ghost-border px-3 py-2">
              {tag}
            </span>
          ))}
        </div>
        {project.caseStudyUrl ? (
          <a
            className="inline-flex items-center font-label-caps text-label-caps text-primary border-b border-primary pb-2 hover:text-on-surface-variant hover:border-on-surface-variant transition-colors duration-300 tracking-[0.1em]"
            href={project.caseStudyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {project.ctaLabel}{" "}
            <span className="material-symbols-outlined ml-3 text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>
              arrow_forward
            </span>
          </a>
        ) : (
          <span
            className="inline-flex items-center font-label-caps text-label-caps text-on-surface-variant border-b border-on-surface-variant/30 pb-2 tracking-[0.1em] opacity-60"
            aria-disabled="true"
          >
            {project.ctaLabel}
          </span>
        )}
      </motion.div>
    </motion.article>
  );
}
