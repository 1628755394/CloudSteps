import { useLocation, useOutlet } from "react-router";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";

const TAB_ORDER = ["/", "/lesson-prep", "/word-books", "/anti-forgetting", "/coach-center"];

function getTabDirection(from: string, to: string) {
  const fromIdx = TAB_ORDER.findIndex(
    (p) => p === from || (p !== "/" && from.startsWith(p)),
  );
  const toIdx = TAB_ORDER.findIndex(
    (p) => p === to || (p !== "/" && to.startsWith(p)),
  );
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return 0;
  return toIdx > fromIdx ? 1 : -1;
}

export function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const prevPathRef = useRef(location.pathname);
  const direction = getTabDirection(prevPathRef.current, location.pathname);

  useEffect(() => {
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: direction * 18 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direction * -18 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="w-full h-full flex flex-col min-h-0 motion-reduce:transform-none motion-reduce:transition-none"
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}

export function FlowPageShell({
  children,
  className = "min-h-screen bg-gray-50 pb-24",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
