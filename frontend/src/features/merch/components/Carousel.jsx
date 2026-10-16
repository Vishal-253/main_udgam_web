import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  ArrowRight,
  Sparkles
} from "lucide-react";

/**
 * Reusable 3-card continuous carousel component for UDGAM Merchandise
 * @param {Object} props
 * @param {Array} props.items - Array of merchandise items
 * @param {number} props.autoPlayInterval - Milliseconds between auto transitions (default: 4000)
 * @param {boolean} props.enableAutoPlay - Whether autoplay is initially active (default: true)
 * @param {Function} props.onSelectProduct - Called when a merchandise card is clicked
 */
export default function Carousel({
  items = [],
  autoPlayInterval = 4000,
  enableAutoPlay = true,
  onSelectProduct,
}) {
  const total = items.length;
  const defaultIdx = items.findIndex((i) => i.id === "udgam-collection-04");
  const [cardIndex, setCardIndex] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [isPlaying, setIsPlaying] = useState(enableAutoPlay);
  const [isHovered, setIsHovered] = useState(false);
  const [spacing, setSpacing] = useState(390);
  const timerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Responsive slot spacing
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setSpacing(Math.min(270, width * 0.7));
      } else if (width < 1024) {
        setSpacing(330);
      } else {
        setSpacing(390);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Safe normalized active index for display
  const activeNormalizedIndex = total > 0 ? ((cardIndex % total) + total) % total : 0;
  const currentItem = items[activeNormalizedIndex] || {};

  // Handlers for navigation
  const nextSlide = useCallback(() => {
    setCardIndex((prev) => prev + 1);
  }, []);

  const prevSlide = useCallback(() => {
    setCardIndex((prev) => prev - 1);
  }, []);


  // Auto-play timer management
  useEffect(() => {
    if (!isPlaying || isHovered || total <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isHovered, autoPlayInterval, nextSlide, total]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        prevSlide();
      } else if (e.key === "ArrowRight") {
        nextSlide();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevSlide, nextSlide]);

  if (!items || total === 0) {
    return <div className="carousel-empty">No merchandise items to display</div>;
  }

  // 5 visible/buffer slots around center (-2, -1, 0, 1, 2)
  const slotOffsets = [-2, -1, 0, 1, 2];
  const renderedSlots = slotOffsets.map((offset) => {
    const virtualIndex = cardIndex + offset;
    const itemIndex = ((virtualIndex % total) + total) % total;
    return {
      virtualIndex,
      slot: offset,
      item: items[itemIndex],
    };
  });

  return (
    <div
      className="carousel-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cards Viewport Stage */}
      <div className="carousel-stage">
        <div className="carousel-cards-track">
          {renderedSlots.map(({ virtualIndex, slot, item }) => {
            const isCenter = slot === 0;
            const isLeft = slot === -1;
            const isRight = slot === 1;

            // Compute target position and visual styles for this slot
            let xPos = slot * spacing;
            let scale = 1;
            let opacity = 1;
            let zIndex = 1;
            let filter = "none";
            let cursor = "pointer";

            if (isCenter) {
              scale = 1.0;
              opacity = 1.0;
              zIndex = 20;
              filter = "brightness(1)";
              cursor = "pointer";
            } else if (isLeft || isRight) {
              scale = 0.82;
              opacity = 0.72;
              zIndex = 10;
              filter = "brightness(0.92) contrast(0.95)";
              cursor = "pointer";
            } else {
              scale = 0.68;
              opacity = 0;
              zIndex = 1;
              cursor = "default";
            }

            return (
              <motion.div
                key={virtualIndex}
                className={`carousel-card ${isCenter ? "is-center" : ""} ${isLeft ? "is-left" : ""
                  } ${isRight ? "is-right" : ""} ${item.inStock === false ? "is-card-out-of-stock" : ""}`}
                style={{
                  zIndex,
                  cursor,
                }}
                initial={false}
                animate={{
                  x: xPos,
                  scale,
                  opacity,
                  filter,
                }}
                transition={{
                  duration: 0.82,
                  ease: [0.22, 1, 0.36, 1],
                }}
                drag={isCenter ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragStart={() => {
                  isDraggingRef.current = true;
                }}
                onDragEnd={(_, { offset }) => {
                  setTimeout(() => {
                    isDraggingRef.current = false;
                  }, 50);

                  if (offset.x < -50) {
                    nextSlide();
                  } else if (offset.x > 50) {
                    prevSlide();
                  }
                }}
                onClick={() => {
                  if (isDraggingRef.current) return;
                  if (onSelectProduct) {
                    onSelectProduct(item);
                  }
                }}
                title={`Click to view ${item.title} details`}
              >
                <div className="card-media-wrapper">
                  <img
                    src={item.image}
                    alt={item.title || item.category}
                    className="card-image"
                    style={{
                      objectPosition: item.imagePosition || 'center',
                      objectFit: item.imageFit || 'cover'
                    }}
                    loading="eager"
                    draggable={false}
                  />

                  {/* Subtle inner ambient gradient */}
                  <div className="card-glass-tint" />

                  {/* Corner Category Tag */}
                  <div className="card-category-badge">
                    <span
                      className="badge-dot"
                      style={{ backgroundColor: item.badgeColor || "#000" }}
                    />
                    <span className="badge-text">{item.category}</span>
                  </div>


                  {/* Sold Out Ribbon / Badge */}
                  {item.inStock === false && (
                    <div className="card-out-of-stock-pill">
                      <span className="stock-dot-red" />
                      <span>SOLD OUT</span>
                    </div>
                  )}

                  {/* Price Tag pill on Card */}
                  {item.price && (
                    <div className="card-price-tag">
                      <span className="card-currency">{item.currency || "₹"}</span>
                      <span className="card-price-num">{item.price.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {/* Center Card Hover Overlay CTA */}
                  {isCenter && (
                    <div className="center-card-hover-cta">
                      <div className={`hover-cta-pill ${item.inStock === false ? "hover-pill-out-stock" : ""}`}>
                        <ShoppingBag size={14} />
                        <span>{item.inStock === false ? "Sold Out • View Details" : "View Merch Details"}</span>
                        <ArrowRight size={13} />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Floating Side Navigation Arrows */}
        <button
          className="nav-arrow nav-arrow-left"
          onClick={(e) => {
            e.stopPropagation();
            prevSlide();
          }}
          aria-label="Previous Slide"
        >
          <ChevronLeft size={22} />
        </button>

        <button
          className="nav-arrow nav-arrow-right"
          onClick={(e) => {
            e.stopPropagation();
            nextSlide();
          }}
          aria-label="Next Slide"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Underneath Selected Card: Animated Category, Title & Direct Order CTA */}
      <div className="carousel-meta-section">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id || activeNormalizedIndex}
            className="carousel-meta-content"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -14, filter: "blur(4px)" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="meta-tag-line">
              <span className="meta-series">
                {Array.from(new Set((currentItem.tag || `0${activeNormalizedIndex + 1} • ${currentItem.category?.toUpperCase()}`).split(" • "))).join(" • ")}
              </span>
            </div>

            <h2 className="meta-category-title">{currentItem.title}</h2>

            <p className="meta-subtitle">{currentItem.subtitle}</p>

            {/* Customization on Hoodie specification */}
            {(currentItem.isBundle || currentItem.id === "udgam-collection-04") ? (
              <div className="meta-bundle-hoodie-perk">
                <Sparkles size={15} className="meta-perk-sparkle" />
                <span>
                  <strong>Full Collection Perk:</strong> Includes all 3 pieces + <strong>Free Name Customization on your Hoodie!</strong>
                </span>
              </div>
            ) : (
              <div className="meta-bundle-hoodie-hint">
                <Sparkles size={13} className="meta-hint-sparkle" />
                <span>
                  Buy all 3 different items to get <strong>Free Custom Name Printing on your Hoodie</strong>
                </span>
              </div>
            )}

            {/* Price & Action Button */}
            <div className="meta-action-row">
              <div className="meta-pricing">
                <span className="meta-price">
                  {currentItem.currency || "₹"}
                  {currentItem.price?.toLocaleString("en-IN")}
                </span>
                {currentItem.originalPrice && (
                  <span className="meta-orig-price">
                    {currentItem.currency || "₹"}
                    {currentItem.originalPrice?.toLocaleString("en-IN")}
                  </span>
                )}
                {currentItem.inStock === false && (
                  <span className="meta-stock-pill-out">Sold Out</span>
                )}
              </div>

              <button
                className={`meta-view-product-btn ${currentItem.inStock === false ? "meta-btn-out-of-stock" : ""
                  }`}
                onClick={() => {
                  if (onSelectProduct && currentItem.id) {
                    onSelectProduct(currentItem);
                  }
                }}
              >
                <span>
                  {currentItem.inStock === false
                    ? "View Details (Sold Out)"
                    : "Select Size & Order"}
                </span>
                <ArrowRight size={15} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
