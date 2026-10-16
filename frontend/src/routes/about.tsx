import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useState, useRef } from "react";
import {
  Trophy,
  Users,
  Palette,
  ArrowRight,
  Flower2,
  Sparkles,
  Camera,
  Layers,
} from "lucide-react";

import aboutBg from "@/assets/about_blossom_bg.jpg";
import campusSketch from "@/assets/campus_original_sketch.png";
import campusPhoto from "@/assets/campus_real_photo.png";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Udgam 2K26 | Chase the Bloom" },
      {
        name: "description",
        content:
          "Where ideas take flight, cultures intertwine, and every moment becomes a memory — Udgam 2K26, the annual cultural festival of NIT Sikkim.",
      },
      { property: "og:title", content: "About Us — Udgam 2K26 | Chase the Bloom" },
      {
        property: "og:description",
        content:
          "Where ideas take flight, cultures intertwine, and every moment becomes a memory — Udgam, the spirit of NIT Sikkim, blooming amidst the Himalayas.",
      },
    ],
  }),
  component: About,
});

const THREE_CARDS = [
  {
    step: "I",
    tag: "THE FIRST BLOOM",
    title: "A Stage for Every Art",
    content:
      "From music and dance to theatre, poetry, and fine arts, Udgam brings student creativity to life in the spirit of spring.",
    icon: Flower2,
  },
  {
    step: "II",
    tag: "A CANOPY OF CULTURE",
    title: "Where Traditions Meet",
    content:
      "A vibrant blend of cultural performances, folk traditions, artistic expression, and friendly competitions that unite diverse talents.",
    icon: Palette,
  },
  {
    step: "III",
    tag: "BLOOMING UNDER THE STARS",
    title: "Nights to Remember",
    content:
      "From electrifying performances to music-filled evenings, celebrate the magic of togetherness beneath the Himalayan sky.",
    icon: Sparkles,
  },
];

const FOUR_CIRCLES = [
  {
    stat: "30+",
    title: "Cultural Competitions",
    subtitle: "Where talent takes the stage",
  },
  {
    stat: "One",
    title: "Vibrant Community",
    subtitle: "Where cultures and friendships bloom",
  },
  {
    stat: "3 Days",
    title: "Of Celebration",
    subtitle: "Music, art, dance and memories",
  },
  {
    stat: "Countless",
    title: "Moments in Bloom",
    subtitle: "Memories that stay long after the petals fall",
  },
];

/**
 * Sharp Interactive Anime Campus Parallax Stage
 * Responds smoothly to mouse move and mobile touch tilt in 3D,
 * with dynamic specular glare, crisp anime linework, and layered depth.
 */
function InteractiveAnimeCampus() {
  const [activeTab, setActiveTab] = useState<"anime" | "photo">("anime");
  const cardRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 180 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [16, -16]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-18, 18]), springConfig);
  const glareX = useTransform(x, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(y, [-0.5, 0.5], ["0%", "100%"]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const normalizedX = (e.clientX - rect.left) / rect.width - 0.5;
    const normalizedY = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(normalizedX);
    y.set(normalizedY);
  };

  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* 3D Parallax Canvas Container */}
      <div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="relative h-84 w-full max-w-md cursor-pointer select-none rounded-[2.5rem] p-3 shadow-2xl transition-shadow duration-300 hover:shadow-pink-300/30"
        style={{ perspective: "1200px" }}
      >
        <motion.div
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          className="relative h-full w-full overflow-hidden rounded-[2.2rem] bg-gradient-to-b from-white/95 via-pink-50/70 to-pink-100/80 p-3 border border-white/90 shadow-xl"
        >
          {/* Subtle Ambient Background Light */}
          <div
            className="absolute inset-0 bg-radial-gradient from-pink-200/40 via-transparent to-transparent pointer-events-none"
            style={{ transform: "translateZ(-20px)" }}
          />

          {/* Active Content: Sharp Anime Illustration vs Real Photo */}
          <div className="relative h-full w-full flex items-center justify-center overflow-hidden rounded-2xl bg-white/70">
            {activeTab === "anime" ? (
              <motion.div
                key="anime"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="relative h-full w-full flex items-center justify-center p-2"
                style={{ transform: "translateZ(25px)" }}
              >
                {/* Sharp, High-Res Hand-drawn Anime Campus Artwork */}
                <img
                  src={campusSketch}
                  alt="NIT Sikkim Campus Anime Illustration"
                  className="max-h-full max-w-full object-contain filter contrast-[1.08] saturate-[1.05] drop-shadow-[0_12px_20px_rgba(244,114,182,0.3)] mix-blend-multiply"
                />

                {/* Floating 3D Badge */}
                <div
                  className="absolute bottom-3 left-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1 text-xs font-bold text-secondary-foreground shadow-sm border border-pink-200"
                  style={{ transform: "translateZ(45px)" }}
                >
                  <span className="text-pink-500">✿</span>
                  <span>NIT Sikkim · 7,000 ft</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="photo"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="relative h-full w-full flex items-center justify-center"
                style={{ transform: "translateZ(25px)" }}
              >
                <img
                  src={campusPhoto}
                  alt="NIT Sikkim Campus Ravangla"
                  className="h-full w-full rounded-2xl object-cover"
                />
                <div
                  className="absolute bottom-3 left-4 rounded-full bg-slate-950/70 px-3.5 py-1 text-xs font-medium text-white backdrop-blur-md"
                  style={{ transform: "translateZ(45px)" }}
                >
                  📍 Ravangla, South Sikkim
                </div>
              </motion.div>
            )}

          </div>

          {/* Dynamic Light Sheen / Glare overlay */}
          <motion.div
            className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none opacity-60"
            style={{
              transform: "translateZ(50px)",
              backgroundPosition: `${glareX} ${glareY}`,
            }}
          />
        </motion.div>
      </div>

      {/* Switcher Toggle: Anime Illustration vs Campus View */}
      <div className="mt-4 flex items-center gap-2 rounded-full bg-white/80 p-1 border border-pink-200/70 shadow-sm">
        <button
          onClick={() => setActiveTab("anime")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
            activeTab === "anime"
              ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm"
              : "text-secondary-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Campus Sketch</span>
        </button>
        <button
          onClick={() => setActiveTab("photo")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
            activeTab === "photo"
              ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm"
              : "text-secondary-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span>Campus View</span>
        </button>
      </div>
    </div>
  );
}

function About() {
  return (
    <div className="relative min-h-screen text-foreground overflow-x-hidden selection:bg-pink-200 selection:text-pink-900">
      {/* Light Ethereal Sky Background with Soft Watercolor Wash */}
      <div className="fixed inset-0 -z-20">
        <img
          src={aboutBg}
          alt="Cherry blossom Himalayas background"
          className="h-full w-full object-cover object-center filter brightness-[1.04] contrast-[1.01]"
        />
        {/* Soft pastel sky wash matching the rest of the website */}
        <div className="absolute inset-0 bg-gradient-to-b from-pink-50/70 via-rose-50/50 to-pink-100/70 backdrop-blur-[2px]" />
      </div>

      {/* Floating Cherry Blossom Petals */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${(i * 23) % 95}%`,
              top: "-5%",
              width: `${10 + (i % 3) * 4}px`,
              height: `${14 + (i % 3) * 5}px`,
              background: "linear-gradient(135deg, rgba(251, 113, 133, 0.75), rgba(244, 114, 182, 0.45))",
              borderRadius: "150% 0 150% 0",
              boxShadow: "0 0 8px rgba(251, 113, 133, 0.3)",
            }}
            animate={{
              y: ["0vh", "110vh"],
              x: [0, (i % 2 === 0 ? 30 : -30), 0],
              rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)],
            }}
            transition={{
              duration: 13 + (i % 4) * 3,
              repeat: Infinity,
              delay: i * 0.9,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Hero Section: Clean, Concise & Poetic */}
      <section className="relative mx-auto max-w-5xl px-5 pt-32 pb-14 text-center md:pt-40 md:pb-18">
        {/* Concentric Circle Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-pink-300/70 bg-white/70 px-5 py-2 text-xs font-bold tracking-widest text-secondary-foreground shadow-sm backdrop-blur-md"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500/15 text-pink-600">
            ✿
          </span>
          <span>CHASE THE BLOOM · UDGAM 2K26</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500/15 text-pink-600">
            ✿
          </span>
        </motion.div>

        {/* Majestic Display Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-6 font-display text-5xl font-semibold tracking-tight text-gradient sm:text-6xl md:text-7xl lg:text-8xl"
        >
          Celebrating Udgam
        </motion.h1>

        {/* Exact Creative Line for Cultural Fest */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-6 max-w-3xl"
        >
          <p className="font-display text-xl md:text-2xl font-medium text-foreground leading-relaxed">
            Where ideas take flight, cultures intertwine, and every moment becomes a memory —{" "}
            <span className="font-bold text-blossom-deep italic">
              Udgam, the spirit of NIT Sikkim, blooming amidst the Himalayas.
            </span>
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#campus-showcase"
            className="btn-blossom inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold shadow-md transition-transform hover:scale-105"
          >
            Explore the Campus
            <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            to="/events"
            className="glass inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-secondary-foreground shadow-sm transition-transform hover:scale-105"
          >
            Explore Events
          </Link>
          <Link
            to="/calendar"
            className="glass inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold text-secondary-foreground shadow-sm transition-transform hover:scale-105"
          >
            Day Calendar
          </Link>
        </motion.div>
      </section>

      {/* Main Content Area */}
      <div className="mx-auto max-w-5xl space-y-16 px-5 pb-24">
        {/* Section 2: Sharp Interactive Anime Campus Parallax Stage */}
        <section id="campus-showcase" className="scroll-mt-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7 }}
            className="glass rounded-[3rem] p-8 md:p-12 shadow-xl border border-white/70"
          >
            <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-12">
              {/* Left Column: Sharp Interactive Anime Campus Stage */}
              <div className="md:col-span-6 flex justify-center">
                <InteractiveAnimeCampus />
              </div>

              {/* Right Column: Clean Cultural Fest Narrative (without the pill) */}
              <div className="md:col-span-6 space-y-4 text-left">
                <h2 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
                  Where Nature & Culture Bloom
                </h2>
                <p className="text-sm md:text-base leading-relaxed text-secondary-foreground/90">
                  Perched against the snow-crested grandeur of Mount Kanchenjunga in Ravangla, the campus of <span className="font-bold text-foreground">NIT Sikkim</span> transforms each spring into an open-air wonderland of creativity.
                </p>
                <p className="text-sm md:text-base leading-relaxed text-muted-foreground">
                  As wild Himalayan cherry blossoms blush across the hillside, Udgam awakens as the vibrant cultural heartbeat of the North East — uniting students, artists, and dreamers from every corner of India under one starlit mountain canopy.
                </p>

                {/* Concentric Pill Badges */}
                <div className="pt-2 flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground shadow-sm border border-pink-200/60">
                    📍 Ravangla · South Sikkim
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground shadow-sm border border-pink-200/60">
                    🌸 Annual Cultural Fest
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Section 3: The Three Cards (Updated exact content from user) */}
        <section className="space-y-8">
          <div className="text-center max-w-xl mx-auto">
            <span className="rounded-full bg-pink-100/80 px-4 py-1 text-xs font-bold tracking-widest text-blossom-deep uppercase">
              THE FESTIVAL EXPERIENCE
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold text-foreground md:text-4xl">
              Three Days in Full Bloom
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {THREE_CARDS.map((card, i) => {
              const IconComp = card.icon;
              return (
                <motion.div
                  key={card.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  whileHover={{ y: -6 }}
                  className="glass rounded-3xl p-7 shadow-sm border border-white/70 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      {/* Concentric Step Indicator */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-pink-300 bg-pink-100/80 font-display text-sm font-bold text-blossom-deep">
                        {card.step}
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-blossom-deep shadow-sm">
                        <IconComp className="h-5 w-5" />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold tracking-wider text-blossom-deep uppercase">
                      {card.tag}
                    </span>
                    <h3 className="mt-1 font-display text-xl font-bold text-foreground">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {card.content}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Section 4: The Last 4 Circles (Updated exact content from user) */}
        <section>
          <div className="glass rounded-3xl p-8 md:p-10 shadow-sm border border-white/70">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {FOUR_CIRCLES.map((item) => (
                <div key={item.title} className="text-center flex flex-col items-center">
                  {/* Concentric Circle Badge */}
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-pink-300 bg-white/80 p-1.5 shadow-sm">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-pink-50 font-display text-lg font-extrabold text-blossom-deep">
                      {item.stat}
                    </div>
                  </div>
                  <div className="mt-4 text-base font-bold text-foreground">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground max-w-[180px] leading-relaxed">
                    {item.subtitle}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
