import { ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Cart button pinned to the top-right of the merch page (just below the site navbar),
 * with an animated quantity badge.
 */
export default function CartButton({ cartCount = 0, onOpenCart }) {
  return (
    <div className="merch-cart-dock">
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
  );
}
