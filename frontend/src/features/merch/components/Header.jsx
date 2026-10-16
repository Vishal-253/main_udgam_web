import { ShoppingBag, ArrowLeft, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

/**
 * UDGAM Header Component
 * - Centered "UDGAM" branding
 * - Top-right interactive Cart button with animated quantity badge
 * - Left contextual action (Back to Collection when inside product view)
 */
export default function Header({
  cartCount = 0,
  onOpenCart,
  currentView = "showcase",
  onNavigateHome,
}) {
  return (
    <header className="udgam-header">
      {/* Left Context Section */}
      <div className="header-left">
        {currentView === "product" ? (
          <button
            className="back-nav-btn"
            onClick={onNavigateHome}
            aria-label="Back to merchandise collection"
          >
            <ArrowLeft size={16} className="back-nav-icon" />
            <span className="back-nav-text">All Merch</span>
          </button>
        ) : (
          <div className="fest-edition-tag">
            <Sparkles size={13} className="fest-sparkle" />
            <span>OFFICIAL DROP '26</span>
          </div>
        )}
      </div>

      {/* Center UDGAM Branding */}
      <div className="header-center">
        <button
          className="brand-logo-btn"
          onClick={onNavigateHome}
          title="Return to UDGAM Merchandise Showcase"
        >
          <span className="brand-logo-text">UDGAM</span>
          <span className="brand-logo-sub">MERCHANDISE</span>
        </button>
      </div>

      {/* Right Actions: Cart Button */}
      <div className="header-right">

        <motion.button
          className="cart-toggle-btn"
          onClick={onOpenCart}
          aria-label={`Open Cart with ${cartCount} items`}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="cart-icon-wrapper">
            <ShoppingBag size={19} className="cart-bag-icon" />
            {cartCount > 0 && (
              <motion.span
                key={cartCount}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="cart-badge-pill"
              >
                {cartCount}
              </motion.span>
            )}
          </div>
          <span className="cart-btn-label">CART</span>
        </motion.button>
      </div>
    </header>
  );
}
