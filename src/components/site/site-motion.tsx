import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "motion/react";

export function BrandLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "route-loading" : "brand-loading"} role="status" aria-label="Loading Grill & Swill">
      <div className="loading-mark" aria-hidden="true">
        <img src="/favicon.png" alt="" width="96" height="96" />
        <div className="loading-grill"><span /><span /><span /><span /><span /></div>
      </div>
      {!compact && <><p className="font-display text-3xl font-black uppercase text-cream">Grill <span className="text-ember">&</span> Swill</p><p className="mt-3 text-xs font-bold uppercase text-cream/65">Firing up the good stuff</p><div className="loading-track" aria-hidden="true"><span /></div></>}
    </div>
  );
}

export function SiteMotion() {
  const [entering, setEntering] = useState(true);
  const { pathname, loading } = useRouterState({ select: (state) => ({ pathname: state.location.pathname, loading: state.isLoading }) });
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const entranceTime = useRef(0);

  useEffect(() => {
    entranceTime.current = performance.now();
    let minimumTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      minimumTimer = setTimeout(() => setEntering(false), Math.max(0, 1050 - (performance.now() - entranceTime.current)));
    };
    const image = document.querySelector<HTMLImageElement>('img[fetchpriority="high"]');
    const ready = image && !image.complete ? new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    }) : Promise.resolve();
    let active = true;
    void Promise.all([ready, document.fonts.ready]).then(() => { if (active) finish(); });
    const maximumTimer = setTimeout(() => setEntering(false), 2300);
    return () => { active = false; clearTimeout(minimumTimer); clearTimeout(maximumTimer); };
  }, []);

  useEffect(() => {
    if (entering || reduced || !window.IntersectionObserver) return;
    const animated = new WeakSet<Element>();
    const animations: Animation[] = [];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || animated.has(entry.target)) continue;
        animated.add(entry.target);
        observer.unobserve(entry.target);
        const element = entry.target as HTMLElement;
        const siblings = element.parentElement ? Array.from(element.parentElement.children) : [];
        const index = Math.max(0, siblings.indexOf(element));
        const delay = Number(element.dataset['revealDelay'] ?? Math.min(index * 55, 220));
        animations.push(element.animate([
          { opacity: 0.35, transform: "translateY(28px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 700, delay, easing: "cubic-bezier(.22,1,.36,1)" }));
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -35px 0px" });
    const observe = () => document.querySelectorAll('main [data-reveal], main article, main [data-testid="menu-card"], main section h2').forEach((element) => {
      if (!animated.has(element)) observer.observe(element);
    });
    observe();
    const main = document.querySelector("main");
    const mutation = new MutationObserver(observe);
    if (main) mutation.observe(main, { childList: true, subtree: true });
    return () => { observer.disconnect(); mutation.disconnect(); animations.forEach((animation) => animation.cancel()); };
  }, [pathname, entering, reduced]);

  return (
    <>
      <motion.div className="reading-progress" style={{ scaleX: reduced ? scrollYProgress : progress }} aria-hidden="true" />
      <AnimatePresence>
        {entering && <motion.div key="entrance" className="loading-overlay" initial={false} exit={{ opacity: 0, y: reduced ? 0 : -24 }} transition={{ duration: reduced ? 0 : 0.45 }}><BrandLoading /></motion.div>}
      </AnimatePresence>
      <AnimatePresence>{!entering && loading && <motion.div key="route" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><BrandLoading compact /></motion.div>}</AnimatePresence>
    </>
  );
}