import { useRef } from "react";
import { motion, useAnimation, useInView } from "framer-motion";
import React from "react";

interface ScrollFadeInProps {
  children: React.ReactNode;
  y?: number;
  duration?: number;
  delay?: number;
  backgroundClassName?: string; // Optional: for solid bg to prevent flash
  className?: string;
}

export default function ScrollFadeIn({
  children,
  y = 40,
  duration = 1.2, // much smoother
  delay = 0,
  className = "",
  backgroundClassName = ""
}: ScrollFadeInProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const controls = useAnimation();

  React.useEffect(() => {
    if (inView) {
      controls.start({
        opacity: 1,
        y: 0,
        transition: { duration, delay, ease: [0.25, 1, 0.5, 1] } // even smoother
      });
    }
  }, [inView, controls, duration, delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={controls}
      style={{ opacity: 0 }}
      className={className}
    >
      {inView && (
        <>
          {backgroundClassName ? <div className={backgroundClassName} /> : null}
          {children}
        </>
      )}
    </motion.div>
  );
}
