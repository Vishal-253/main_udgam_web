import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/events", label: "Events" },
  { to: "/gallery", label: "Gallery" },
  { to: "/merch", label: "Merch" },
  { to: "/about", label: "About Us" },
  { to: "/calendar", label: "Day Calendar" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="glass flex w-full max-w-5xl items-center justify-between rounded-full px-5 py-2.5">
        <Link to="/" className="font-display text-xl font-semibold text-gradient">Udgam ✿ 2K26</Link>
        <ul className="hidden gap-1 md:flex">
          {links.map((l) => (
            <li key={l.to}>
              <Link to={l.to} preload="intent" activeOptions={{ exact: true }} className="group relative block rounded-full px-4 py-2 text-sm font-semibold text-secondary-foreground">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full btn-blossom" transition={{ type: "spring", bounce: 0.3 }} />}
                    <motion.span whileHover={{ y: -2 }} className={`relative inline-block ${isActive ? "text-primary-foreground" : ""}`}>
                      {l.label}
                    </motion.span>
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 scale-0 text-xs text-blossom-deep transition-transform group-hover:scale-100">✿</span>
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <button className="md:hidden text-secondary-foreground" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} className="glass absolute top-16 w-[calc(100%-2rem)] rounded-3xl p-3 md:hidden">
            {links.map((l, i) => (
              <motion.li key={l.to} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={l.to} preload="intent" onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 font-semibold text-secondary-foreground hover:bg-secondary">{l.label}</Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  );
}
