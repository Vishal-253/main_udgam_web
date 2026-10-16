import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  X,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

/**
 * Slide-over Cart Drawer Component
 * - Manages items, quantities, size breakdown
 * - Online checkout / payment is disabled on this site
 */
export default function CartDrawer({
  isOpen,
  onClose,
  items = [],
  onUpdateQuantity,
  onRemoveItem,
  onSelectProduct,
}) {
  const hasOutOfStockItems = items.some((item) => item.product.inStock === false);

  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const subtotal = total;
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Check if all three flagship products are in cart (or bundle)
  const hasTshirt = items.some(
    (item) =>
      item.product.id?.startsWith("udgam-tshirt-01") ||
      item.product.title?.toLowerCase().includes("t-shirt")
  );
  const hasHoodie = items.some(
    (item) =>
      item.product.id?.startsWith("udgam-hoodie-02") ||
      item.product.title?.toLowerCase().includes("hoodie")
  );
  const hasQuarterZip = items.some(
    (item) =>
      item.product.id?.startsWith("udgam-quarterzip-03") ||
      item.product.title?.toLowerCase().includes("quarter zip")
  );
  const hasAllThreeDifferentItems =
    (hasTshirt && hasHoodie && hasQuarterZip) ||
    items.some((item) => item.product.id === "udgam-collection-04" || item.product.isBundle);


  return (
    <AnimatePresence>
      {isOpen && (
        <div className="cart-portal-wrapper">
          {/* Backdrop Blur */}
          <motion.div
            className="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Slide-over Drawer */}
          <motion.div
            className="cart-drawer-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="cart-drawer-header">
              <div className="cart-header-title-group">
                <ShoppingBag size={20} className="cart-header-icon" />
                <h2 className="cart-header-title">Your Merch Bag</h2>
                <span className="cart-header-count">({totalItemCount})</span>
              </div>

              <button
                className="cart-close-btn"
                onClick={onClose}
                aria-label="Close cart"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div className="cart-drawer-body">
              {items.length === 0 ? (
                /* Empty State */
                <div className="cart-empty-state">
                  <div className="empty-cart-icon-bubble">
                    <ShoppingBag size={38} className="empty-bag-icon" />
                  </div>
                  <h3 className="empty-state-title">Your bag is empty</h3>
                  <p className="empty-state-desc">
                    Explore the official UDGAM '26 merchandise line and grab your summit essentials before stocks run out.
                  </p>
                  <button
                    className="explore-merch-btn"
                    onClick={onClose}
                  >
                    <span>Browse Collection</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                /* Items List */
                <div className="cart-items-list">
                  {hasAllThreeDifferentItems && (
                    <div className="cart-perk-unlocked-banner">
                      <Sparkles size={16} className="unlocked-icon" />
                      <div>
                        <strong>Free Custom Name Unlocked!</strong>
                        <p>All 3 pieces added. Free name printing on your Hoodie is included with your order.</p>
                      </div>
                    </div>
                  )}
                  {items.map((item) => {
                    const itemColor = item.color || item.product.color;
                    const itemKey = `${item.product.id}-${item.size}-${itemColor || ""}`;
                    return (
                      <motion.div
                        key={itemKey}
                        className="cart-item-row"
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        {/* Thumbnail */}
                        <button
                          className="cart-item-thumb-btn"
                          onClick={() => {
                            if (onSelectProduct) onSelectProduct(item.product);
                            onClose();
                          }}
                          title="View product details"
                        >
                          <img
                            src={item.product.image}
                            alt={item.product.title}
                            className="cart-item-thumb-img"
                          />
                        </button>

                        {/* Info */}
                        <div className="cart-item-info">
                          <div className="cart-item-top">
                            <span className="cart-item-category">
                              {item.product.category}
                            </span>
                            <button
                              className="cart-item-remove-btn"
                              onClick={() => onRemoveItem(item.product.id, item.size, itemColor)}
                              title="Remove item"
                              aria-label="Remove item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <h4
                            className="cart-item-name"
                            onClick={() => {
                              if (onSelectProduct) onSelectProduct(item.product);
                              onClose();
                            }}
                          >
                            {item.product.title}
                          </h4>

                          <div className="cart-item-meta-tags">
                            <span className="cart-size-pill">
                              Size: <strong>{item.size}</strong>
                            </span>
                            {itemColor && (
                              <span className="cart-color-pill">
                                Color: <strong>{itemColor}</strong>
                              </span>
                            )}
                            {item.product.inStock === false && (
                              <span className="cart-item-out-of-stock-pill">Sold Out</span>
                            )}
                          </div>

                          {/* Stepper and Price */}
                          <div className="cart-item-bottom">
                            <div className="cart-stepper">
                              <button
                                className="stepper-btn"
                                onClick={() =>
                                  onUpdateQuantity(
                                    item.product.id,
                                    item.size,
                                    item.quantity - 1,
                                    itemColor
                                  )
                                }
                                aria-label="Decrease quantity"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="stepper-count">
                                {item.quantity}
                              </span>
                              <button
                                className="stepper-btn"
                                onClick={() =>
                                  onUpdateQuantity(
                                    item.product.id,
                                    item.size,
                                    item.quantity + 1,
                                    itemColor
                                  )
                                }
                                aria-label="Increase quantity"
                              >
                                <Plus size={13} />
                              </button>
                            </div>

                            <div className="cart-item-pricing">
                              <span className="item-total-price">
                                ₹{(item.product.price * item.quantity).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Summary & Checkout (Only when items exist) */}
            {items.length > 0 && (
              <div className="cart-drawer-footer">
                {/* Price Breakdown (No coupons) */}
                <div className="cart-breakdown">
                  <div className="breakdown-row">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>

                  <div className="breakdown-row">
                    <span>Campus Distribution</span>
                    <span className="free-shipping-tag">FREE</span>
                  </div>

                  <div className="breakdown-divider" />

                  <div className="breakdown-row total-row">
                    <span>Total Amount</span>
                    <span className="total-amount">
                      ₹{total.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Out of Stock Warning if any */}
                {hasOutOfStockItems && (
                  <div className="cart-out-of-stock-warning">
                    <AlertTriangle size={15} className="warning-icon" />
                    <span>All items are sold out • Orders are closed</span>
                  </div>
                )}

                {/* Checkout CTA (online ordering disabled) */}
                <button
                  className="checkout-primary-btn disabled-checkout"
                  disabled
                  title="Online checkout is not available yet"
                >
                  <span>
                    {hasOutOfStockItems
                      ? "Sold Out • Ordering Closed"
                      : "Online Checkout Coming Soon"}
                  </span>
                  <ArrowRight size={17} />
                </button>

                <div className="cart-guarantee-note">
                  <ShieldCheck size={14} />
                  <span>NIT Sikkim • Official UDGAM Merchandise</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
