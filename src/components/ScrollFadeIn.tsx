import { useRef } from "react";
import { motion, useAnimation, useInView } from "framer-motion";
import React from "react";

interface ScrollFadeInProps {
  children: React.ReactNode;
  y?: number;
  duration?: number;
  delay?: number;
  className?: string;
}

export default function ScrollFadeIn({
  children,
  y = 40,
  duration = 0.7,
  delay = 0,
  className = ""
}: ScrollFadeInProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const controls = useAnimation();

  React.useEffect(() => {
    if (inView) {
      controls.start({
        opacity: 1,
        y: 0,
        transition: { duration, delay, ease: [0.22, 1, 0.36, 1] }
      });
    }
  }, [inView, controls, duration, delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={controls}
      className={className}
    >
      {children}
    </motion.div>
  );
}
