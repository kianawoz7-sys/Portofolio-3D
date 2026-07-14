import { useLayoutEffect, useRef } from "react";
import type React from "react";
import { motion, useScroll, useTransform } from "motion/react";
import gsap from "gsap";

import { contactHref } from "../../data/navLinks";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { easePremium } from "../../lib/animation";
import { Button } from "../ui/Button";

function CenteredHeroVisual() {
  const visualRef = useRef<HTMLDivElement>(null);
  const bgPlaneRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const blueLayerRef = useRef<HTMLDivElement>(null);
  const blueImageRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const visual = visualRef.current;
    const section = visual?.closest("section");
    const bgPlane = bgPlaneRef.current;
    const cat = catRef.current;
    const glow = glowRef.current;
    const blueLayer = blueLayerRef.current;
    const blueImage = blueImageRef.current;
    if (!visual || !section || !bgPlane || !cat || !glow || !blueLayer || !blueImage) return;

    let removeListeners = () => {};
    const ctx = gsap.context(() => {
      gsap.set(visual, { transformPerspective: 1200 });
      gsap.set(bgPlane, {
        x: 0,
        y: 0,
        rotationX: 0,
        rotationY: 0,
        scale: 1.08,
        force3D: true,
        transformOrigin: "50% 50%",
      });
      gsap.set(cat, {
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: 0,
        rotationX: 0,
        rotationY: 0,
        scale: 1,
        force3D: true,
        transformOrigin: "50% 50%",
      });
      gsap.set(glow, {
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: 0,
        scale: 1,
        force3D: true,
      });
      gsap.set(blueLayer, {
        opacity: 0,
        "--reveal-x": "50%",
        "--reveal-y": "50%",
        "--reveal-width": "0px",
        "--reveal-height": "0px",
      });
      gsap.set(blueImage, {
        x: 0,
        y: 0,
        rotationX: 0,
        rotationY: 0,
        scale: 1.1,
        force3D: true,
        transformOrigin: "50% 50%",
      });

      const blueX = gsap.quickTo(blueImage, "x", { duration: 1.45, ease: "power3.out" });
      const blueY = gsap.quickTo(blueImage, "y", { duration: 1.45, ease: "power3.out" });
      const blueRotationX = gsap.quickTo(blueImage, "rotationX", { duration: 1.55, ease: "power3.out" });
      const blueRotationY = gsap.quickTo(blueImage, "rotationY", { duration: 1.55, ease: "power3.out" });
      const blueScale = gsap.quickTo(blueImage, "scale", { duration: 1.55, ease: "power3.out" });

      const catX = gsap.quickTo(cat, "x", { duration: 1.45, ease: "power3.out" });
      const catY = gsap.quickTo(cat, "y", { duration: 1.45, ease: "power3.out" });
      const catRotationX = gsap.quickTo(cat, "rotationX", { duration: 1.5, ease: "power3.out" });
      const catRotationY = gsap.quickTo(cat, "rotationY", { duration: 1.5, ease: "power3.out" });
      const catScale = gsap.quickTo(cat, "scale", { duration: 1.5, ease: "power3.out" });

      const glowX = gsap.quickTo(glow, "x", { duration: 1.15, ease: "power3.out" });
      const glowY = gsap.quickTo(glow, "y", { duration: 1.15, ease: "power3.out" });
      const glowScale = gsap.quickTo(glow, "scale", { duration: 1.3, ease: "power3.out" });

      const revealX = gsap.quickSetter(blueLayer, "--reveal-x", "px") as (value: number) => void;
      const revealY = gsap.quickSetter(blueLayer, "--reveal-y", "px") as (value: number) => void;
      const revealWidth = gsap.quickSetter(blueLayer, "--reveal-width", "px") as (value: number) => void;
      const revealHeight = gsap.quickSetter(blueLayer, "--reveal-height", "px") as (value: number) => void;
      const blueOpacity = gsap.quickTo(blueLayer, "opacity", { duration: 0.75, ease: "power3.out" });

      const resetLayers = () => {
        gsap.to(blueImage, { x: 0, y: 0, rotationX: 0, rotationY: 0, scale: 1.1, duration: 1.75, ease: "power3.out" });
        gsap.to(cat, { x: 0, y: 0, rotationX: 0, rotationY: 0, scale: 1, duration: 1.8, ease: "power3.out" });
        gsap.to(glow, { x: 0, y: 0, scale: 1, duration: 1.45, ease: "power3.out" });
        gsap.to(blueLayer, {
          opacity: 0,
          "--reveal-width": "0px",
          "--reveal-height": "0px",
          duration: 1.1,
          ease: "power3.out",
        });
      };

      const handleMove = (event: MouseEvent | PointerEvent) => {
        if ("pointerType" in event && event.pointerType === "touch") return;

        const rect = section.getBoundingClientRect();
        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;

        if (!inside) {
          resetLayers();
          return;
        }

        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const pointerX = localX / rect.width;
        const pointerY = localY / rect.height;
        const nx = (pointerX - 0.5) * 2;
        const ny = (pointerY - 0.5) * 2;
        const catRect = cat.getBoundingClientRect();
        const catCenterX = catRect.left + catRect.width / 2;
        const catCenterY = catRect.top + catRect.height / 2;
        const distanceFromCat = Math.hypot(event.clientX - catCenterX, event.clientY - catCenterY);
        const proximity = Math.max(0, 1 - distanceFromCat / Math.min(rect.width * 0.42, 520));
        const softProximity = proximity * proximity;
        const revealBase = Math.min(rect.width, rect.height);
        const revealWidthPx = 180 + softProximity * revealBase * 0.5;
        const revealHeightPx = 125 + softProximity * revealBase * 0.34;

        blueX(-nx * 34);
        blueY(-ny * 26);
        blueRotationX(ny * 1.6);
        blueRotationY(-nx * 2.0);
        blueScale(1.1 + softProximity * 0.012);

        catX(nx * 7);
        catY(ny * 6);
        catRotationX(-ny * 0.6);
        catRotationY(nx * 0.7);
        catScale(1 + softProximity * 0.025);

        glowX(nx * 16);
        glowY(ny * 12);
        glowScale(1 + softProximity * 0.08);

        revealX(localX);
        revealY(localY);
        revealWidth(revealWidthPx);
        revealHeight(revealHeightPx);
        blueOpacity(0.38 + softProximity * 0.5);
      };

      section.addEventListener("mousemove", handleMove);
      section.addEventListener("pointermove", handleMove);
      section.addEventListener("mouseleave", resetLayers);
      section.addEventListener("pointerleave", resetLayers);

      removeListeners = () => {
        section.removeEventListener("mousemove", handleMove);
        section.removeEventListener("pointermove", handleMove);
        section.removeEventListener("mouseleave", resetLayers);
        section.removeEventListener("pointerleave", resetLayers);
      };
    }, visual);

    return () => {
      removeListeners();
      ctx.revert();
    };
  }, []);

  return (
    <motion.div
      ref={visualRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
    >
      <div
        ref={bgPlaneRef}
        className="absolute inset-0"
        style={{
          transform: "translate3d(0,0,0)",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <img
          src="/Hero1.png"
          alt=""
          aria-hidden="true"
          className="hero-background hero-background--base absolute inset-0 h-full w-full object-cover"
          style={{
            objectPosition: "center",
            transform: "translate3d(0,0,0)",
          }}
        />
      </div>

      <div
        ref={blueLayerRef}
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          transform: "translate3d(0,0,0)",
          transformStyle: "preserve-3d",
          WebkitMaskImage:
            "radial-gradient(ellipse var(--reveal-width) var(--reveal-height) at var(--reveal-x) var(--reveal-y), #000 0%, #000 32%, rgba(0,0,0,0.78) 55%, rgba(0,0,0,0.28) 76%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse var(--reveal-width) var(--reveal-height) at var(--reveal-x) var(--reveal-y), #000 0%, #000 32%, rgba(0,0,0,0.78) 55%, rgba(0,0,0,0.28) 76%, transparent 100%)",
          opacity: 0,
          willChange: "transform, opacity",
          zIndex: 1,
        }}
      >
        <img
          ref={blueImageRef}
          src="/Hero2.png"
          alt=""
          aria-hidden="true"
          className="hero-background hero-background--blue absolute -inset-[8%] h-[116%] w-[116%] object-cover"
          style={{
            objectPosition: "center",
            transform: "translate3d(0,0,0) scale(1.1)",
          }}
        />
      </div>

      <div
        ref={glowRef}
        aria-hidden="true"
        className="hero-glow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "34vmin",
          aspectRatio: "1",
          background:
            "radial-gradient(circle, rgba(209,255,238,0.48) 0%, rgba(67,229,196,0.24) 42%, rgba(14,95,90,0.08) 62%, transparent 76%)",
          filter: "blur(24px)",
          zIndex: 1,
        }}
      />

      <img
        ref={catRef}
        src="/Kucing-Hero-Cropped.png"
        alt="Black cat"
        className="hero-cat absolute left-1/2 top-1/2 h-auto max-w-none"
        style={{
          width: "clamp(180px, 18vw, 300px)",
          transform: "translate3d(-50%,-50%,0)",
          filter: "brightness(0.9) contrast(1.18) saturate(1.08) drop-shadow(0 28px 62px rgba(0,0,0,0.45))",
          willChange: "transform",
          zIndex: 4,
        }}
      />

      <div
        aria-hidden="true"
        className="hero-side-veil absolute inset-0"
        style={{
          zIndex: 2,
          background:
            "linear-gradient(90deg, rgba(2, 13, 14, 0.82) 0%, rgba(4, 20, 20, 0.66) 24%, rgba(5, 23, 22, 0.34) 44%, rgba(5, 23, 22, 0.1) 60%, rgba(5, 23, 22, 0) 74%)",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08]"
        style={{
          zIndex: 5,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.24) 0, rgba(255,255,255,0.24) 1px, transparent 1px, transparent 3px)",
          mixBlendMode: "overlay",
        }}
      />
    </motion.div>
  );
}

export function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const reducedMotion = usePrefersReducedMotion();

  const headlineY = useTransform(scrollYProgress, [0, 1], reducedMotion ? ["0%", "0%"] : ["0%", "-18%"]);
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.9], reducedMotion ? [1, 1] : [1, 0.72]);
  const sectionScale = useTransform(scrollYProgress, [0.5, 1], reducedMotion ? [1, 1] : [1, 0.96]);
  const metadataTextStyle = {
    color: "rgba(255, 247, 232, 0.68)",
    textShadow: "0 2px 18px rgba(0, 10, 11, 0.72), 0 0 1px rgba(255, 247, 232, 0.34)",
  };

  return (
    <div ref={ref} className="hero-stage relative">
      <motion.section
        ref={sectionRef as React.RefObject<HTMLElement>}
        style={{ scale: sectionScale }}
        className="hero-section sticky top-0 flex flex-col justify-center overflow-hidden bg-[#030606] z-10"
      >
        <CenteredHeroVisual />

        <div className="hero-content max-w-[1440px] mx-auto px-6 md:px-20 w-full pt-24 relative z-20">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.8, ease: easePremium }}
            className="hero-metadata flex flex-col md:flex-row justify-between mb-10 md:mb-16 gap-4"
          >
            <span className="font-label-caps text-xs text-on-surface-variant tracking-[0.2em] uppercase" style={metadataTextStyle}>
              Pengembang Full-stack
            </span>
            <span className="font-label-caps text-xs text-on-surface-variant tracking-[0.2em] uppercase md:text-right" style={metadataTextStyle}>
              React / Node / Supabase
            </span>
          </motion.div>

          <div className="relative w-full">
            <motion.h1
              style={{
                y: headlineY,
                opacity: headlineOpacity,
                textShadow: "0 8px 34px rgba(0, 7, 8, 0.42), 0 1px 1px rgba(0, 0, 0, 0.28)",
              }}
              className="hero-headline font-display-lg font-normal text-[2.8rem] md:text-[5.25rem] lg:text-[88px] text-[#fff7e8] leading-[0.95] tracking-[-0.01em] relative z-20 max-w-[1100px]"
            >
              <motion.span
                className="block"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.1, ease: easePremium }}
              >
                Membangun produk
              </motion.span>
              <motion.span
                className="block"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.3, ease: easePremium }}
              >
                digital yang halus
              </motion.span>
              <motion.span
                className="block"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.5, ease: easePremium }}
              >
                dari antarmuka ke infrastruktur.
              </motion.span>
            </motion.h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.9, ease: easePremium }}
            className="hero-actions flex flex-col md:flex-row gap-6 mt-16 md:mt-20 relative z-20"
          >
            <Button
              className="award-button award-button--primary inline-flex items-center justify-center bg-[#fff7e8] text-primary font-label-caps text-xs tracking-[0.15em] uppercase px-12 py-6 rounded-none"
              href="#projects"
              style={{
                color: "rgba(5, 7, 7, 0.96)",
                boxShadow: "0 16px 44px rgba(0, 7, 8, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.22)",
              }}
            >
              Lihat Proyek
            </Button>
            <Button
              className="award-button award-button--ghost inline-flex items-center justify-center ghost-border text-[#fff7e8] font-label-caps text-xs tracking-[0.15em] uppercase px-12 py-6 rounded-none"
              href={contactHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "rgba(255, 247, 232, 0.88)",
                borderColor: "rgba(255, 247, 232, 0.48)",
                backgroundColor: "transparent",
                textShadow: "0 2px 14px rgba(0, 7, 8, 0.62)",
                boxShadow: "0 0 0 1px rgba(255, 247, 232, 0.08)",
              }}
            >
              Hubungi Saya
            </Button>
          </motion.div>
        </div>
        <div className="hero-bottom-veil" aria-hidden="true" />
        <div className="hero-scroll-cue" aria-hidden="true"><i /></div>
      </motion.section>
    </div>
  );
}
