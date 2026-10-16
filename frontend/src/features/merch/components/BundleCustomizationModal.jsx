import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Check, ShoppingBag, AlertCircle } from "lucide-react";
import { colorSwatches } from "../data/merchData";

const TSHIRT_COLORS = ["White", "Beige"];
const HOODIE_COLORS = ["Pink", "Black"];

/**
 * BundleCustomizationModal
 * Allows customer to select colors for T-Shirt and Hoodie before adding
 * the Udgam26 Collection bundle to the cart.
 */
export default function BundleCustomizationModal({
  isOpen,
  onClose,
  bundleProduct,
  selectedSize = "M",
  quantity = 1,
  initialCustomName = "",
  onConfirm,
}) {
  const [tshirtColor, setTshirtColor] = useState("");
  const [hoodieColor, setHoodieColor] = useState("");
  const [customName, setCustomName] = useState(initialCustomName);
  const [showValidationWarning, setShowValidationWarning] = useState(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setCustomName(initialCustomName);
      setShowValidationWarning(false);
    }
  }

  if (!isOpen) return null;

  const isComplete = Boolean(tshirtColor && hoodieColor);

  const handleConfirm = () => {
    if (!isComplete) {
      setShowValidationWarning(true);
      return;
    }

    onConfirm({
      tshirtColor,
      hoodieColor,
      customName: customName.trim().toUpperCase(),
    });
  };

  const totalPrice = (bundleProduct?.price || 1980) * quantity;

  return (
    <AnimatePresence>
      <div className="bundle-modal-overlay" onClick={onClose}>
        <motion.div
          className="bundle-modal-card"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bundle-modal-title"
        >
          {/* Header */}
          <div className="bundle-modal-header">
            <div>
              <div className="bundle-modal-pill">
                <Sparkles size={13} className="bundle-modal-sparkle" />
                <span>BUNDLE COLOR CUSTOMIZATION</span>
              </div>
              <h2 id="bundle-modal-title" className="bundle-modal-title">
                Customize Your Collection
              </h2>
              <p className="bundle-modal-subtitle">
                Select your preferred colorway for each apparel piece in this bundle.
              </p>
            </div>
            <button
              className="bundle-modal-close-btn"
              onClick={onClose}
              aria-label="Close customization modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="bundle-modal-body">
            {/* 1. T-Shirt Color Selection */}
            <div className="bundle-section-group">
              <div className="bundle-section-header">
                <span className="step-number-badge">1</span>
                <div>
                  <h3 className="bundle-section-title">
                    T-Shirt Color <span className="required-star">*</span>
                  </h3>
                  <p className="bundle-section-desc">
                    {tshirtColor ? (
                      <span className="selected-variant-text">
                        Selected: <strong>{tshirtColor} T-Shirt</strong>
                      </span>
                    ) : (
                      "Choose White or Beige"
                    )}
                  </p>
                </div>
              </div>

              <div className="color-swatch-options-grid">
                {TSHIRT_COLORS.map((color) => {
                  const isSelected = tshirtColor === color;
                  const swatch = colorSwatches[color] || { hex: "#eee" };
                  return (
                    <button
                      key={color}
                      type="button"
                      className={`bundle-color-option-btn ${isSelected ? "is-selected" : ""}`}
                      onClick={() => {
                        setTshirtColor(color);
                        if (showValidationWarning && hoodieColor) {
                          setShowValidationWarning(false);
                        }
                      }}
                    >
                      <span
                        className="swatch-circle"
                        style={{
                          backgroundColor: swatch.hex,
                          borderColor: swatch.dotBorder || swatch.border || "#d1d5db",
                        }}
                      />
                      <span className="swatch-label">{color}</span>
                      {isSelected && <Check size={15} className="swatch-check-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Hoodie Color Selection */}
            <div className="bundle-section-group">
              <div className="bundle-section-header">
                <span className="step-number-badge">2</span>
                <div>
                  <h3 className="bundle-section-title">
                    Hoodie Color <span className="required-star">*</span>
                  </h3>
                  <p className="bundle-section-desc">
                    {hoodieColor ? (
                      <span className="selected-variant-text">
                        Selected: <strong>{hoodieColor} Hoodie</strong>
                      </span>
                    ) : (
                      "Choose Pink or Black"
                    )}
                  </p>
                </div>
              </div>

              <div className="color-swatch-options-grid">
                {HOODIE_COLORS.map((color) => {
                  const isSelected = hoodieColor === color;
                  const swatch = colorSwatches[color] || { hex: "#eee" };
                  return (
                    <button
                      key={color}
                      type="button"
                      className={`bundle-color-option-btn ${isSelected ? "is-selected" : ""}`}
                      onClick={() => {
                        setHoodieColor(color);
                        if (showValidationWarning && tshirtColor) {
                          setShowValidationWarning(false);
                        }
                      }}
                    >
                      <span
                        className="swatch-circle"
                        style={{
                          backgroundColor: swatch.hex,
                          borderColor: swatch.dotBorder || swatch.border || "#d1d5db",
                        }}
                      />
                      <span className="swatch-label">{color}</span>
                      {isSelected && <Check size={15} className="swatch-check-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Sweatshirt / Quarter Zip Note */}
            <div className="bundle-included-item-card">
              <div className="included-item-left">
                <span className="included-check">✓</span>
                <div>
                  <strong>Udgam26 Quarter Zip</strong>
                  <p>Official Festival Edition included with your bundle</p>
                </div>
              </div>
              <span className="included-tag">Standard Drop</span>
            </div>

            {/* 4. Free Name Customization on Hoodie */}
            <div className="bundle-custom-name-box">
              <div className="custom-name-title-row">
                <Sparkles size={14} className="custom-name-sparkle" />
                <strong>Free Custom Name on Hoodie (Included)</strong>
              </div>
              <input
                type="text"
                className="bundle-name-input"
                placeholder="e.g. RAHUL (Optional)"
                maxLength={20}
                value={customName}
                onChange={(e) => setCustomName(e.target.value.toUpperCase())}
              />
              <span className="custom-name-note">
                Name will be printed on the back spine of your Hoodie. Leave blank for standard edition.
              </span>
            </div>

            {/* Validation Warning Alert */}
            {showValidationWarning && !isComplete && (
              <motion.div
                className="bundle-validation-warning"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AlertCircle size={16} />
                <span>
                  Please select both a <strong>T-Shirt color</strong> and a <strong>Hoodie color</strong> before adding the bundle to your cart.
                </span>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bundle-modal-footer">
            <div className="bundle-footer-info">
              <span className="footer-size-label">
                Size: <strong>{selectedSize}</strong> • Qty: <strong>{quantity}</strong>
              </span>
              <span className="footer-price-val">
                {bundleProduct?.currency || "₹"}
                {totalPrice.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bundle-footer-buttons">
              <button
                type="button"
                className="bundle-cancel-btn"
                onClick={onClose}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`bundle-confirm-btn ${!isComplete ? "is-disabled" : ""}`}
                onClick={handleConfirm}
              >
                <ShoppingBag size={17} />
                <span>Add Bundle to Cart</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
