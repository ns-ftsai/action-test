// cart.js

export function createCart() {
  return {
    items: [],
    discount: 0,
  };
}

export function addItem(cart, item) {
  const existingItem = cart.items.find(i => i.id === item.id);
  if (existingItem) {
    existingItem.quantity += item.quantity;
  } else {
    cart.items.push(item);
  }
  return cart;
}

export function removeItem(cart, itemId) {
  cart.items = cart.items.filter(i => i.id !== itemId);
  return cart;
}

export function applyDiscount(cart, discountPercentage) {
  if (discountPercentage < 0 || discountPercentage > 100) {
    throw new Error('Invalid discount percentage');
  }
  cart.discount = discountPercentage;
  return cart;
}

export function calculateTotal(cart) {
  const subtotal = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  const discountAmount = subtotal * (cart.discount / 100);
  return subtotal - discountAmount;
}
