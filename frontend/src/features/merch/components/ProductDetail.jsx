import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  ArrowLeft,
  Check,
  Truck,
  ShieldCheck,
  Ruler,
  Info,
  X,
  ZoomIn,
  AlertTriangle,
  Ban,
  Sparkles
} from "lucide-react";
import { colorSwatches, getProductDynamicName } from "../data/merchData";
import BundleCustomizationModal from "./BundleCustomizationModal";

/**
 * Product Detail Page Component
 * - Left column: High-res merchandise photography with swipe navigation on mobile and interactive hover zoom on desktop
 * - Right column: Title, pricing, rich description, size selection, quantity selector, and Add to Cart action
 */
export default function ProductDetail({
  product,
  onAddToCart,
  onBack,
  onOpenCart,
}) {
  const isOutOfStock = product.inStock === false;
  const isBundle = product.isBundle || product.id === "udgam-collection-04";

  // Color options: read directly from product data
  const availableColors = React.useMemo(() => {
    if (isBundle) return [];
    return Array.isArray(product.colors) ? product.colors.filter(Boolean) : [];
  }, [product.id, product.colors, isBundle]);

  const [prevProductKey, setPrevProductKey] = useState(product.id);
  const [selectedColor, setSelectedColor] = useState(() => (availableColors[0] || ""));

  if (product.id !== prevProductKey) {
    setPrevProductKey(product.id);
    setSelectedColor(availableColors[0] || "");
  }

  // Dynamic product name reflecting selected color
  const dynamicTitle = getProductDynamicName(product, selectedColor) || product.title;

  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);

  const [selectedSize, setSelectedSize] = useState(
    product.sizes && product.sizes.length > 0 ? product.sizes[0] : "M"
  );

  const images =
    product.colorGalleries && product.colorGalleries[selectedColor] && product.colorGalleries[selectedColor].length > 0
      ? product.colorGalleries[selectedColor]
      : product.gallery && product.gallery.length > 0
        ? product.gallery
        : product.image
          ? [product.image]
          : [];

  const [activeImageIndex, setActiveImageIndex] = useState(() => {
    const initialImg = product.image || (product.gallery && product.gallery[0]);
    const idx = images.indexOf(initialImg);
    return idx !== -1 ? idx : 0;
  });
  const [swipeDirection, setSwipeDirection] = useState(0);
  const selectedImage = images[activeImageIndex] || product.image;

  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [customName, setCustomName] = useState("");

  // Mobile / Touch device detection
  const [isMobileOrTouch, setIsMobileOrTouch] = useState(false);

  // Reset gallery to first image whenever color changes
  useEffect(() => {
    setActiveImageIndex(0);
    setSwipeDirection(0);
  }, [selectedColor]);

  useEffect(() => {
    const checkMobile = () => {
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const isNarrowScreen = window.innerWidth <= 960;
      const noHover = window.matchMedia("(hover: none)").matches;
      setIsMobileOrTouch(hasCoarsePointer || isNarrowScreen || noHover);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Amazon-style zoom states (desktop only)
  const [isZooming, setIsZooming] = useState(false);
  const [zoomCoords, setZoomCoords] = useState({ x: 50, y: 50, lensX: 0, lensY: 0 });
  const [showLightbox, setShowLightbox] = useState(false);
  const imageViewportRef = useRef(null);

  // Swiping refs
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchDeltaXRef = useRef(0);
  const isSwipingRef = useRef(false);
  const justSwipedRef = useRef(false);

  // Gallery navigation functions
  const handleNextImage = () => {
    if (images.length <= 1) return;
    setSwipeDirection(1);
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    if (images.length <= 1) return;
    setSwipeDirection(-1);
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleSelectImage = (idx) => {
    if (idx === activeImageIndex) return;
    setSwipeDirection(idx > activeImageIndex ? 1 : -1);
    setActiveImageIndex(idx);
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e) => {
    if (images.length <= 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchDeltaXRef.current = 0;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (images.length <= 1) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartXRef.current;
    const deltaY = currentY - touchStartYRef.current;
    touchDeltaXRef.current = deltaX;
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      isSwipingRef.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (images.length <= 1) return;
    const deltaX = touchDeltaXRef.current;
    const threshold = 35; // minimum swipe distance in px

    if (Math.abs(deltaX) > threshold) {
      justSwipedRef.current = true;
      setTimeout(() => {
        justSwipedRef.current = false;
      }, 150);

      if (deltaX < 0) {
        handleNextImage();
      } else {
        handlePrevImage();
      }
    }
    touchDeltaXRef.current = 0;
    isSwipingRef.current = false;
  };

  const handleTouchCancel = () => {
    touchDeltaXRef.current = 0;
    isSwipingRef.current = false;
  };

  // Calculate discount percentage
  const discountPercent = product.originalPrice
    ? Math.round(
      ((product.originalPrice - product.price) / product.originalPrice) * 100
    )
    : null;

  const handleAddToCart = () => {
    if (isOutOfStock) return;

    // Bundle Customization before adding to cart
    if (isBundle) {
      setIsBundleModalOpen(true);
      return;
    }

    const productVariant = {
      ...product,
      id: selectedColor ? `${product.baseId || product.id}-${selectedColor.toLowerCase()}` : product.id,
      baseId: product.baseId || product.id,
      title: dynamicTitle,
      color: selectedColor || undefined,
    };

    onAddToCart(productVariant, selectedSize, quantity, customName);
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 2200);
  };

  const handleConfirmBundleCustomization = ({ tshirtColor, hoodieColor, customName: modalCustomName }) => {
    setIsBundleModalOpen(false);
    if (modalCustomName) {
      setCustomName(modalCustomName);
    }
    onAddToCart(
      product,
      selectedSize,
      quantity,
      modalCustomName || customName,
      { tshirtColor, hoodieColor }
    );
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 2200);
  };

  const incrementQty = () => {
    if (isOutOfStock) return;
    setQuantity((q) => Math.min(10, q + 1));
  };
  const decrementQty = () => {
    if (isOutOfStock) return;
    setQuantity((q) => Math.max(1, q - 1));
  };

  // Desktop hover zoom mouse handlers
  const handleMouseEnter = () => {
    if (isMobileOrTouch) return;
    setIsZooming(true);
  };

  const handleMouseLeave = () => {
    if (isMobileOrTouch) return;
    setIsZooming(false);
  };

  const handleMouseMove = (e) => {
    if (isMobileOrTouch || !imageViewportRef.current) return;
    const rect = imageViewportRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const percentX = Math.max(0, Math.min(100, (clientX / rect.width) * 100));
    const percentY = Math.max(0, Math.min(100, (clientY / rect.height) * 100));

    // Lens dimensions
    const lensW = 140;
    const lensH = 140;
    const lensX = Math.max(0, Math.min(rect.width - lensW, clientX - lensW / 2));
    const lensY = Math.max(0, Math.min(rect.height - lensH, clientY - lensH / 2));

    setZoomCoords({ x: percentX, y: percentY, lensX, lensY });
  };

  const handleViewportClick = () => {
    if (justSwipedRef.current) return;
    setShowLightbox(true);
  };

  return (
    <motion.div
      className="product-detail-container"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Top Breadcrumb & Back Bar */}
      <div className="product-top-bar">
        <button
          className="product-back-btn"
          onClick={onBack}
          aria-label="Return to merchandise carousel"
        >
          <ArrowLeft size={16} />
          <span>Back to Merch</span>
        </button>

        <div className="product-breadcrumb">
          <span className="breadcrumb-muted">NIT Sikkim</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-muted">Udgam</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{dynamicTitle}</span>
        </div>
      </div>

      {/* Main 2-Column Product Layout */}
      <div className="product-detail-grid">
        {/* ===================================================
            LEFT COLUMN: MERCH PHOTO & GALLERY WITH SWIPE
        =================================================== */}
        <div className="product-gallery-column">
          <div
            ref={imageViewportRef}
            className={`main-image-viewport ${!isMobileOrTouch && isZooming ? "is-zooming" : ""}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onClick={handleViewportClick}
            title={isMobileOrTouch ? "Tap to view full-screen image" : "Hover to zoom • Click to view full-screen image"}
          >
            <AnimatePresence mode="wait" custom={swipeDirection}>
              <motion.img
                key={selectedImage}
                src={selectedImage}
                alt={`${product.title} - angle ${activeImageIndex + 1}`}
                className="main-product-image"
                style={{
                  objectPosition: product.imagePosition || 'center',
                  objectFit: product.imageFit || 'cover'
                }}
                custom={swipeDirection}
                variants={{
                  enter: (dir) => ({
                    opacity: 0,
                    x: dir > 0 ? 40 : dir < 0 ? -40 : 0,
                    scale: 0.98,
                  }),
                  center: {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  },
                  exit: (dir) => ({
                    opacity: 0,
                    x: dir > 0 ? -40 : dir < 0 ? 40 : 0,
                    scale: 0.98,
                  }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeOut" }}
                draggable={false}
              />
            </AnimatePresence>

            {/* In-place on-top Zoom Magnification Layer */}
            {isZooming && (
              <div
                className="inplace-zoom-layer"
                style={{ overflow: 'hidden' }}
              >
                <img
                  src={selectedImage}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: product.imageFit || 'cover',
                    objectPosition: product.imagePosition || 'center',
                    transform: `scale(2.6)`,
                    transformOrigin: `${zoomCoords.x}% ${zoomCoords.y}%`,
                    pointerEvents: 'none'
                  }}
                />
              </div>
            )}

            {/* Subtle overlay badges */}
            <div className="image-badge-row">
              <span
                className="image-badge-pill"
                style={{
                  backgroundColor: product.badgeColor || "var(--color-soft-charcoal)",
                }}
              >
                {product.badgeText || "OFFICIAL MERCH"}
              </span>

              <div className="image-badge-right-group">
                {images.length > 1 && (
                  <span className="image-counter-pill">
                    {activeImageIndex + 1}/{images.length}
                  </span>
                )}

                {isOutOfStock ? (
                  <span className="image-stock-pill out-of-stock">
                    <span className="stock-dot-red" />
                    Sold Out
                  </span>
                ) : (
                  <span className="image-stock-pill in-stock">
                    <span className="stock-pulse-dot" />
                    <span className="stock-text-full">In Stock • Campus Pickup</span>
                    <span className="stock-text-short">In Stock</span>
                  </span>
                )}
              </div>
            </div>

            {/* Zoom Hint Pill */}
            <div className="zoom-hint-badge">
              <ZoomIn size={13} />
              <span>{isZooming ? "2.6x In-Place Detail Zoom" : "Hover to zoom • Click to expand"}</span>
            </div>
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="gallery-thumbnails">
              {images.map((thumbUrl, idx) => (
                <button
                  key={idx}
                  className={`thumbnail-card ${activeImageIndex === idx ? "active" : ""
                    }`}
                  onClick={() => handleSelectImage(idx)}
                  aria-label={`View angle ${idx + 1}`}
                >
                  <img src={thumbUrl} alt="" className="thumb-img" draggable={false} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ===================================================
            RIGHT COLUMN: DESCRIPTION, SIZE CHOICE & ADD TO CART
        =================================================== */}
        <div className="product-info-column">
          {/* Header Metadata */}
          <div className="product-meta-header">
            <span className="product-series-tag">
              NIT SIKKIM • {Array.from(new Set((product.tag || "OFFICIAL UDGAM DROP").split(" • "))).join(" • ")}
            </span>
            <h1 className="product-headline">{dynamicTitle}</h1>
            <p className="product-tagline">{product.subtitle}</p>

            <div className="product-fest-stamp-row">
              <span className="fest-stamp">🌸 Chase the bloom • NIT Sikkim</span>
            </div>
          </div>

          {/* Pricing Row */}
          <div className="product-price-section">
            <span className="current-price">
              {product.currency}
              {product.price.toLocaleString("en-IN")}
            </span>
            {product.originalPrice && (
              <span className="original-price">
                {product.currency}
                {product.originalPrice.toLocaleString("en-IN")}
              </span>
            )}
            {discountPercent && (
              <span className="discount-tag">{discountPercent}% OFF</span>
            )}
            <span className="tax-note">All taxes included</span>
          </div>

          {/* Sold Out Warning Banner */}
          {isOutOfStock && (
            <div className="product-out-of-stock-alert">
              <AlertTriangle size={18} className="stock-alert-icon" />
              <div className="stock-alert-body">
                <strong className="stock-alert-title">Officially Sold Out</strong>
                <p className="stock-alert-text">
                  All slots for this edition have been claimed. This merchandise is officially sold out and no longer available to buy. Thank you for your incredible support for UDGAM 2026!
                </p>
              </div>
            </div>
          )}

          <div className="divider-line" />

          {/* Description */}
          <div className="product-description-block">
            <h3 className="section-subtitle">Garment Specifications</h3>
            <p className="description-paragraph">{product.description}</p>

            {/* Key Feature Specs */}
            {product.features && product.features.length > 0 && (
              <ul className="features-list">
                {product.features.map((feat, i) => (
                  <li key={i} className="feature-item">
                    <Check size={14} className="feature-check" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Combo Exclusive Bonus Banner */}
          {isBundle && (
            <div className="combo-bonus-banner">
              <Sparkles size={16} className="combo-bonus-icon" />
              <p className="combo-bonus-text">
                <strong>Combo Exclusive Bonus:</strong> Unlock <span className="combo-bonus-highlight">FREE personalized name printing</span> on your hoodie when you buy the full set!
              </p>
            </div>
          )}

          <div className="divider-line" />

          {/* ===================================================
              COLOR SELECTION SECTION (FOR T-SHIRT & HOODIE)
          =================================================== */}
          {availableColors.length > 0 && (
            <div className="color-selector-section">
              <div className="color-header-row">
                <label className="color-label">
                  Select Color: <strong className="active-color-name">{selectedColor}</strong>
                </label>
                <span className="color-variant-hint">
                  Variant: <strong>{dynamicTitle}</strong>
                </span>
              </div>

              <div className="color-pill-grid">
                {availableColors.map((color) => {
                  const swatch = colorSwatches[color] || { hex: "#eee" };
                  const isSelected = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      className={`color-choice-btn ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedColor(color)}
                      aria-label={`Select ${color} color`}
                    >
                      <span
                        className="swatch-indicator-dot"
                        style={{
                          backgroundColor: swatch.hex,
                          borderColor: swatch.dotBorder || swatch.border || "#d1d5db",
                        }}
                      />
                      <span className="color-choice-name">{color}</span>
                      {isSelected && <Check size={14} className="color-selected-check" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {availableColors.length > 0 && <div className="divider-line" />}

          {/* ===================================================
              SIZE CHOICE SELECTOR
          =================================================== */}
          <div className="size-selector-section">
            <div className="size-header-row">
              <label className="size-label">
                Select Size: <strong className="active-size-name">{selectedSize}</strong>
              </label>

              <button
                type="button"
                className="size-guide-trigger"
                onClick={() => setShowSizeGuide(true)}
              >
                <Ruler size={14} />
                <span>Size Guide</span>
              </button>
            </div>

            <div className="size-pill-grid">
              {product.sizes &&
                product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`size-choice-btn ${selectedSize === size ? "selected" : ""
                      }`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
            </div>

            {product.fitNote && (
              <div className="fit-note-banner">
                <Info size={14} className="fit-note-icon" />
                <span>{product.fitNote}</span>
              </div>
            )}

            {/* Udgam26 Collection Special Perk: Custom Name Printing on Hoodie */}
            {product.isBundle && (
              <div className="bundle-custom-card">
                <div className="bundle-custom-header">
                  <Sparkles size={16} className="bundle-custom-icon" />
                  <strong>Free Custom Name on Hoodie</strong>
                </div>
                <p className="bundle-custom-desc">
                  Buying the full Udgam26 Collection includes complimentary name customization. Specify the name to print:
                </p>
                <input
                  type="text"
                  className="bundle-custom-input"
                  placeholder={isOutOfStock ? "Sold Out" : "e.g. RAHUL"}
                  maxLength={20}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value.toUpperCase())}
                  disabled={isOutOfStock}
                />
                <span className="bundle-custom-hint">
                  * Note: Name will only be printed on the Hoodie. Leave blank if you prefer no custom print.
                </span>
              </div>
            )}
          </div>

          {/* ===================================================
              QUANTITY SELECTOR & ADD TO CART
          =================================================== */}
          <div className="purchase-actions-row">
            {/* Quantity Stepper */}
            <div className={`quantity-stepper ${isOutOfStock ? "is-disabled" : ""}`}>
              <button
                type="button"
                className="qty-btn"
                onClick={decrementQty}
                disabled={isOutOfStock || quantity <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="qty-display">{quantity}</span>
              <button
                type="button"
                className="qty-btn"
                onClick={incrementQty}
                disabled={isOutOfStock || quantity >= 10}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {/* Primary Add to Cart Button */}
            <motion.button
              type="button"
              className={`add-to-cart-cta ${isOutOfStock ? "disabled-out-of-stock" : isAdded ? "success-state" : ""
                }`}
              onClick={isOutOfStock ? undefined : handleAddToCart}
              disabled={isOutOfStock}
              whileTap={isOutOfStock ? undefined : { scale: 0.97 }}
              aria-disabled={isOutOfStock}
              title={isOutOfStock ? "This item is sold out" : "Add to Cart"}
            >
              {isOutOfStock ? (
                <>
                  <Ban size={19} className="cta-icon" />
                  <span>Sold Out • Not Available to Buy</span>
                </>
              ) : isAdded ? (
                <>
                  <Check size={19} className="cta-icon" />
                  <span>Added to Cart!</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={19} className="cta-icon" />
                  <span>
                    Add to Cart • {product.currency}
                    {(product.price * quantity).toLocaleString("en-IN")}
                  </span>
                </>
              )}
            </motion.button>
          </div>

          {/* Quick View Cart link if already added */}
          {isAdded && (
            <motion.div
              className="quick-cart-notice"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              <span>
                Added <strong>{dynamicTitle}</strong> to your bag (Size <strong>{selectedSize}</strong>{selectedColor ? ` • ${selectedColor}` : ""}).
              </span>
              <button className="view-bag-link" onClick={onOpenCart}>
                View Cart →
              </button>
            </motion.div>
          )}

          {/* Assurance / Trust Badges */}
          <div className="trust-perks-grid">
            <div className="trust-item">
              <Truck size={17} className="trust-icon" />
              <div>
                <strong>NIT Sikkim Campus Distribution</strong>
                <p>Pick up at festival merchandise counter or hostel drop</p>
              </div>
            </div>

            <div className="trust-item">
              <Sparkles size={17} className="trust-icon" />
              <div>
                <strong>Authentic & Premium Quality</strong>
                <p>100% genuine official festival merchandise, crafted with durable materials</p>
              </div>
            </div>

            <div className="trust-item">
              <ShieldCheck size={17} className="trust-icon" />
              <div>
                <strong>Official Merchandise</strong>
                <p>100% certified official Udgam '26 product</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================
          SIZE GUIDE MODAL
      =================================================== */}
      <AnimatePresence>
        {showSizeGuide && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSizeGuide(false)}
          >
            <motion.div
              className="size-guide-card"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title-group">
                  <Ruler size={20} className="modal-icon" />
                  <h3 className="modal-title">UDGAM Size Specifications</h3>
                </div>
                <button
                  className="modal-close-btn"
                  onClick={() => setShowSizeGuide(false)}
                  aria-label="Close size guide"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <p className="size-guide-intro">
                  All measurements are in inches. Please measure yourself before ordering.
                </p>

                {/* T-SHIRT SIZE CHART */}
                <div className="size-section-label">
                  <span className="size-section-tag">👕 T-Shirt — Boxy Fit</span>
                </div>
                <div className="size-table-wrapper">
                  <table className="size-table">
                    <thead>
                      <tr>
                        <th>Size</th>
                        <th>XS</th>
                        <th>S</th>
                        <th>M</th>
                        <th>L</th>
                        <th>XL</th>
                        <th>XXL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Length</strong></td>
                        <td>25</td><td>25.5</td><td>26.5</td><td>27.5</td><td>28</td><td>28.5</td>
                      </tr>
                      <tr>
                        <td><strong>Chest</strong></td>
                        <td>42</td><td>44</td><td>46</td><td>48</td><td>50</td><td>52</td>
                      </tr>
                      <tr>
                        <td><strong>Shoulder</strong></td>
                        <td>20</td><td>21</td><td>22</td><td>23</td><td>24</td><td>25</td>
                      </tr>
                      <tr>
                        <td><strong>Sleeve Length</strong></td>
                        <td>9.25</td><td>9.5</td><td>9.75</td><td>10</td><td>10.25</td><td>10.75</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="size-guide-note">Note: Boxy fit is wider from the chest and has a shorter length compared to oversized fit.</p>

                {/* HOODIE / QUARTER ZIP SIZE CHART */}
                <div className="size-section-label" style={{ marginTop: "22px" }}>
                  <span className="size-section-tag">🧥 Hoodie &amp; Quarter Zip</span>
                </div>
                <div className="size-table-wrapper">
                  <table className="size-table">
                    <thead>
                      <tr>
                        <th>Size</th>
                        <th>S</th>
                        <th>M</th>
                        <th>L</th>
                        <th>XL</th>
                        <th>XXL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Length</strong></td>
                        <td>24</td><td>25</td><td>26</td><td>27</td><td>28.5</td>
                      </tr>
                      <tr>
                        <td><strong>Chest</strong></td>
                        <td>38</td><td>40</td><td>42</td><td>44</td><td>46</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="size-guide-note">*Average sleeve length of M size Hoodie is 25 inches.</p>

                <div className="measure-tip">
                  <strong>How to measure:</strong> Lay your garment flat. Chest = armpit to armpit. Length = highest point of shoulder to hemline.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================================================
          FULL-SCREEN LIGHTBOX MODAL
      =================================================== */}
      <AnimatePresence>
        {showLightbox && (
          <motion.div
            className="lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLightbox(false)}
          >
            <button
              className="lightbox-close-btn"
              onClick={() => setShowLightbox(false)}
              aria-label="Close full view"
            >
              <X size={24} />
            </button>
            <motion.img
              src={selectedImage}
              alt={product.title}
              className="lightbox-image"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bundle Customization Modal */}
      {isBundle && (
        <BundleCustomizationModal
          isOpen={isBundleModalOpen}
          onClose={() => setIsBundleModalOpen(false)}
          bundleProduct={product}
          selectedSize={selectedSize}
          quantity={quantity}
          initialCustomName={customName}
          onConfirm={handleConfirmBundleCustomization}
        />
      )}
    </motion.div>
  );
}
