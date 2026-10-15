import { motion } from "framer-motion";

export function BlossomLoader({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #fff0f5 0%, #fce4ef 50%, #fbd4e9 100%)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      {/* Subtle background petals */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            top: `${10 + (i * 11) % 80}%`,
            left: `${5 + (i * 13) % 90}%`,
            width: 16 + (i % 3) * 8,
            height: (16 + (i % 3) * 8) * 0.72,
            borderRadius: "150% 0 150% 0",
            background: "linear-gradient(135deg, rgba(255,180,210,0.4), rgba(245,143,180,0.25))",
            pointerEvents: "none",
          }}
          animate={{ y: [0, -10, 0], rotate: [0, 15, 0] }}
          transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
        />
      ))}

      {/* Logo + text container */}
      <motion.div
        className="relative flex flex-col items-center gap-6"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        onAnimationComplete={onDone}
      >
        {/* Udgam Logo */}
        <motion.div
          className="relative flex items-center justify-center"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Glow ring behind logo */}
          <motion.div
            style={{
              position: "absolute",
              inset: -24,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(236,100,150,0.35) 0%, transparent 70%)",
              filter: "blur(18px)",
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <img
            src="/favicon.ico"
            alt="Udgam Logo"
            style={{
              width: 120,
              height: 120,
              objectFit: "contain",
              position: "relative",
              zIndex: 1,
              filter: "drop-shadow(0 8px 24px rgba(220,80,130,0.45))",
            }}
          />
        </motion.div>

        {/* Title */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <p
            className="font-display text-6xl md:text-7xl"
            style={{
              background: "linear-gradient(135deg, oklch(0.55 0.19 358), oklch(0.75 0.14 20))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Udgam
          </p>
          <p style={{ marginTop: 6, letterSpacing: "0.5em", color: "oklch(0.5 0.05 350)", fontSize: 14 }}>
            2K26
          </p>
        </motion.div>

        {/* Loading bar */}
        <div style={{ width: 160, height: 3, borderRadius: 99, background: "rgba(220,130,170,0.2)", overflow: "hidden", marginTop: 4 }}>
          <motion.div
            style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, oklch(0.62 0.17 355), oklch(0.75 0.14 20))" }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
