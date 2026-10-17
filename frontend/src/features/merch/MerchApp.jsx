import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import CartButton from "./components/CartButton";
import Carousel from "./components/Carousel";
import ProductDetail from "./components/ProductDetail";
import CartDrawer from "./components/CartDrawer";
import { merchItems } from "./data/merchData";
import PetalsOverlay from "./components/PetalsOverlay";

const CART_STORAGE_KEY = "udgam_merch_cart_v2";

export default function MerchApp() {
  // Master merchandise catalog
  const products = merchItems;

  // Clean up legacy products localStorage key if present
  useEffect(() => {
    try {
      localStorage.removeItem("udgam_products_catalog_v14");
    } catch {
      // Fallback
    }
  }, []);

  // Navigation view state: 'showcase' | 'product'
  const [currentView, setCurrentView] = useState("showcase");
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Cart state with localStorage persistence and live stock verification
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => {
        const liveProd = merchItems.find(
          (p) => p.id === (item.product?.baseId || item.product?.id) || p.id === item.product?.id
        );
        return {
          ...item,
          product: {
            ...item.product,
            inStock: liveProd ? liveProd.inStock : false,
          },
        };
      });
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Save cart changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [cart]);

  // Sync hash routing for natural browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;

      if (hash.startsWith("#product-")) {
        const prodId = hash.replace("#product-", "");
        const found = products.find((p) => p.id === prodId);
        if (found) {
          setSelectedProduct(found);
          setCurrentView("product");
        }
      } else {
        setCurrentView("showcase");
        setSelectedProduct(null);
      }
    };

    if (window.location.hash) {
      handleHashChange();
    }

    window.addEventListener("popstate", handleHashChange);
    return () => window.removeEventListener("popstate", handleHashChange);
  }, [products]);

  // Handler to open product detail view
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setCurrentView("product");
    window.location.hash = `product-${product.id}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handler to return to merchandise carousel showcase
  const handleNavigateHome = () => {
    setCurrentView("showcase");
    setSelectedProduct(null);
    window.location.hash = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Cart operations
  const handleAddToCart = (product, size, quantity, customName = "", bundleCustomization = null) => {
    // Strictly prevent adding out of stock product to cart
    const liveProd = products.find((p) => p.id === (product.baseId || product.id)) || product;
    if (liveProd.inStock === false) {
      return;
    }

    // If Udgam26 Collection is added, add all 3 individual items with chosen colors to the cart.
    if (liveProd.id === "udgam-collection-04" || liveProd.isBundle) {
      const tshirtColor = bundleCustomization?.tshirtColor || "White";
      const hoodieColor = bundleCustomization?.hoodieColor || "Pink";

      const tshirtTargetId = `udgam-tshirt-01-${tshirtColor.toLowerCase()}`;
      const hoodieTargetId = `udgam-hoodie-02-${hoodieColor.toLowerCase()}`;

      const tshirtBase = products.find((p) => p.id === tshirtTargetId) || merchItems.find((p) => p.id === tshirtTargetId) || products.find((p) => p.baseId === "udgam-tshirt-01") || merchItems.find((p) => p.baseId === "udgam-tshirt-01");
      const hoodieBase = products.find((p) => p.id === hoodieTargetId) || merchItems.find((p) => p.id === hoodieTargetId) || products.find((p) => p.id?.startsWith("udgam-hoodie-02")) || merchItems.find((p) => p.id?.startsWith("udgam-hoodie-02"));
      const quarterzip = products.find((p) => p.id === "udgam-quarterzip-03") || merchItems.find((p) => p.id === "udgam-quarterzip-03");

      const customizedTshirt = {
        ...tshirtBase,
        id: tshirtTargetId,
        baseId: "udgam-tshirt-01",
        title: `${tshirtColor} T-Shirt`,
        color: tshirtColor,
      };

      const customizedHoodie = {
        ...hoodieBase,
        id: hoodieTargetId,
        baseId: "udgam-hoodie-02",
        title: `${hoodieColor} Hoodie`,
        color: hoodieColor,
      };

      const bundleItems = [
        { prod: customizedTshirt, size, qty: quantity, color: tshirtColor },
        { prod: customizedHoodie, size, qty: quantity, color: hoodieColor },
        { prod: quarterzip, size, qty: quantity, color: undefined }
      ].filter((b) => b.prod && b.prod.inStock !== false);

      setCart((prevCart) => {
        let updated = [...prevCart];
        bundleItems.forEach(({ prod, size: s, qty, color: c }) => {
          const existingIdx = updated.findIndex(
            (item) =>
              item.product.id === prod.id &&
              item.size === s &&
              (item.color || item.product.color) === (c || prod.color)
          );
          if (existingIdx > -1) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              quantity: updated[existingIdx].quantity + qty,
            };
          } else {
            updated.push({ product: prod, size: s, quantity: qty, color: c || prod.color });
          }
        });
        return updated;
      });
      return;
    }

    // Individual item addition
    const itemColor = product.color || undefined;
    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.size === size &&
          (item.color || item.product.color) === itemColor
      );

      if (existingIdx > -1) {
        const updated = [...prevCart];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + quantity,
        };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            product: {
              ...product,
              title: product.title,
              color: itemColor,
            },
            size,
            quantity,
            color: itemColor,
          },
        ];
      }
    });
  };

  const handleUpdateQuantity = (productId, size, newQty, color) => {
    if (newQty <= 0) {
      handleRemoveItem(productId, size, color);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        const matches =
          item.product.id === productId &&
          item.size === size &&
          (color === undefined || (item.color || item.product.color) === color);
        return matches ? { ...item, quantity: newQty } : item;
      })
    );
  };

  const handleRemoveItem = (productId, size, color) => {
    setCart((prevCart) =>
      prevCart.filter((item) => {
        const matches =
          item.product.id === productId &&
          item.size === size &&
          (color === undefined || (item.color || item.product.color) === color);
        return !matches;
      })
    );
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="merch-root app-container">
      {/* Decorative Subtle Cherry Blossom Branches in Top Corners */}
      <div className="sakura-corner sakura-corner-left" aria-hidden="true">
        <img
          src="/merch-assets/sakura-branch-left.webp"
          alt=""
          className="sakura-branch-img"
          draggable={false}
        />
      </div>
      <div className="sakura-corner sakura-corner-right" aria-hidden="true">
        <img
          src="/merch-assets/sakura-branch-right.webp"
          alt=""
          className="sakura-branch-img"
          draggable={false}
        />
      </div>

      {/* Subtle Floating Petals Across All Views */}
      <PetalsOverlay />

      {/* Top-Right Cart (the site navbar handles navigation) */}
      <CartButton cartCount={totalCartCount} onOpenCart={() => setIsCartOpen(true)} />

      {/* Main View Area with Animated Transitions */}
      <main className="app-main-content">
        <AnimatePresence mode="wait">
          {/* PRODUCT DETAIL PAGE */}
          {currentView === "product" && selectedProduct && (
            <ProductDetail
              key={selectedProduct.id}
              product={
                products.find((p) => p.id === selectedProduct.id) || selectedProduct
              }
              onAddToCart={handleAddToCart}
              onBack={handleNavigateHome}
              onOpenCart={() => setIsCartOpen(true)}
            />
          )}

          {/* SHOWCASE CAROUSEL (HOME) */}
          {currentView === "showcase" && (
            <motion.section
              key="showcase-view"
              className="carousel-showcase-section"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.35 }}
            >
              {/* Core 3-Card Continuous Merchandise Carousel */}
              <Carousel
                items={products}
                autoPlayInterval={4000}
                enableAutoPlay={true}
                onSelectProduct={handleSelectProduct}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Slide-over Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onSelectProduct={handleSelectProduct}
      />

      {/* Bottom Footer */}
      <footer className="app-footer">
        <div className="footer-branding">
          <span className="footer-inst">NIT Sikkim</span>
          <span className="footer-dot">•</span>
          <span className="footer-fest">Udgam</span>
          <span className="footer-dot">•</span>
          <span className="footer-theme">🌸 Chase the Bloom</span>
        </div>
      </footer>
    </div>
  );
}
