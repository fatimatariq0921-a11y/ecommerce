
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { products, categories } from './data'
import { apiFetch } from './lib/api.js'

/* ── helpers ── */
const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r))
const fmt = (n) => `$${n.toFixed(2)}`
const orderId = () => 'ORD-' + Math.random().toString(36).substring(2,8).toUpperCase()

/* ── badge colour helper ── */
function BadgeClass(badge) {
  if (!badge) return ''
  if (badge === 'Sale') return 'badge-sale'
  if (badge === 'Hot') return 'badge-hot'
  if (badge === 'Top Rated') return 'badge-top'
  return ''
}

/* ── Reusable Input Field (Moved Outside to Prevent Focus Loss) ── */
const Field = ({ id, label, col, errors, ...rest }) => (
  <div className="form-group" style={col === 'full' ? {gridColumn:'1/-1'} : {}}>
    <label htmlFor={id}>{label}</label>
    <input id={id} {...rest} className={errors[id] ? 'err' : ''} />
    {errors[id] && <span style={{fontSize:'0.75rem',color:'#ef4444'}}>{errors[id]}</span>}
  </div>
)

/* ══════════════════════════════════════════════
   CART DRAWER
══════════════════════════════════════════════ */
function CartDrawer({ cart, onClose, onUpdate, onRemove, onClear, onCheckout }) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const shipping = subtotal > 100 ? 0 : 9.99
  const tax = subtotal * 0.08
  const total = subtotal + shipping + tax

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="cart-drawer">
        <div className="drawer-head">
          <h2>My Cart <span>({cart.reduce((s,i)=>s+i.qty,0)})</span></h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-items">
          {cart.length === 0 ? (
            <div className="drawer-empty">
              <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              <p>Your cart is empty</p>
            </div>
          ) : cart.map(item => (
            <div className="cart-item" key={item.id}>
              <img src={item.image} alt={item.name} />
              <div className="cart-item-info">
                <div className="cart-item-name">{item.name}</div>
                <div className="cart-item-cat">{item.category}</div>
                <div className="cart-item-bottom">
                  <span className="cart-item-price">{fmt(item.price * item.qty)}</span>
                  <div className="qty-ctrl">
                    <button className="qty-btn" onClick={() => onUpdate(item.id, item.qty - 1)}>−</button>
                    <span className="qty-val">{item.qty}</span>
                    <button className="qty-btn" onClick={() => onUpdate(item.id, item.qty + 1)}>+</button>
                    <button className="remove-btn" onClick={() => onRemove(item.id)} title="Remove">✕</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="drawer-footer">
            <div className="order-summary">
              <div className="summary-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className="summary-row"><span>Shipping</span><span>{shipping === 0 ? 'Free 🎉' : fmt(shipping)}</span></div>
              <div className="summary-row"><span>Tax (8%)</span><span>{fmt(tax)}</span></div>
              <div className="summary-row total"><span>Total</span><span>{fmt(total)}</span></div>
            </div>
            <button className="checkout-btn" onClick={onCheckout}>
              🔒 Proceed to Checkout
            </button>
            <button className="clear-btn" onClick={onClear}>Clear Cart</button>
          </div>
        )}
      </aside>
    </>
  )
}

/* ══════════════════════════════════════════════
   CHECKOUT MODAL
══════════════════════════════════════════════ */
function CheckoutModal({ cart, onClose, onSuccess }) {
  const [payMethod, setPayMethod] = useState('card')
  const [form, setForm] = useState({ fname:'', lname:'', email:'', phone:'', address:'', city:'', zip:'', country:'US', cardNum:'', expiry:'', cvv:'', cardName:'' })
  const [errors, setErrors] = useState({})

  const subtotal = cart.reduce((s,i) => s + i.price * i.qty, 0)
  const shipping = subtotal > 100 ? 0 : 9.99
  const tax = subtotal * 0.08
  const total = subtotal + shipping + tax

  const set = (k) => (e) => setForm(f => ({...f, [k]: e.target.value}))

  const validate = () => {
    const e = {}
    if (!form.fname) e.fname = 'Required'
    if (!form.lname) e.lname = 'Required'
    if (!form.email || !form.email.includes('@')) e.email = 'Valid email required'
    if (!form.address) e.address = 'Required'
    if (!form.city) e.city = 'Required'
    if (!form.zip) e.zip = 'Required'
    if (payMethod === 'card') {
      if (!form.cardNum || form.cardNum.replace(/\s/g,'').length < 16) e.cardNum = 'Enter valid card number'
      if (!form.expiry) e.expiry = 'Required'
      if (!form.cvv || form.cvv.length < 3) e.cvv = 'Required'
      if (!form.cardName) e.cardName = 'Required'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) onSuccess(orderId(), fmt(total))
  }

  const fmtCard = (v) => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim()

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>🛍 Checkout</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Contact */}
          <div className="form-section">
            <h3>📧 Contact Information</h3>
            <div className="form-grid">
              <Field id="fname" label="First Name" placeholder="John" value={form.fname} onChange={set('fname')} errors={errors} />
              <Field id="lname" label="Last Name"  placeholder="Doe"  value={form.lname} onChange={set('lname')} errors={errors} />
              <Field id="email" label="Email" type="email" placeholder="john@email.com" value={form.email} onChange={set('email')} errors={errors} />
              <Field id="phone" label="Phone" placeholder="+1 (555) 000-0000" value={form.phone} onChange={set('phone')} errors={errors} />
            </div>
          </div>

          {/* Shipping */}
          <div className="form-section">
            <h3>📦 Shipping Address</h3>
            <div className="form-grid">
              <div className="form-group" style={{gridColumn:'1/-1'}}>
                <label>Street Address</label>
                <input placeholder="123 Main St, Apt 4B" value={form.address} onChange={set('address')} className={errors.address ? 'err' : ''} />
                {errors.address && <span style={{fontSize:'0.75rem',color:'#ef4444'}}>{errors.address}</span>}
              </div>
              <Field id="city" label="City" placeholder="New York" value={form.city} onChange={set('city')} errors={errors} />
              <Field id="zip"  label="ZIP Code" placeholder="10001" value={form.zip} onChange={set('zip')} errors={errors} />
              <div className="form-group">
                <label>Country</label>
                <select value={form.country} onChange={set('country')}>
                  <option value="US">🇺🇸 United States</option>
                  <option value="GB">🇬🇧 United Kingdom</option>
                  <option value="CA">🇨🇦 Canada</option>
                  <option value="AU">🇦🇺 Australia</option>
                  <option value="PK">🇵🇰 Pakistan</option>
                  <option value="IN">🇮🇳 India</option>
                  <option value="DE">🇩🇪 Germany</option>
                </select>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="form-section">
            <h3>💳 Payment Method</h3>
            <div className="pay-methods">
              {[
                { id:'card',   icon:'💳', label:'Credit Card' },
                { id:'paypal', icon:'🅿️', label:'PayPal' },
                { id:'apple',  icon:'🍎', label:'Apple Pay' },
                { id:'google', icon:'🔵', label:'Google Pay' },
                { id:'crypto', icon:'₿',  label:'Crypto' },
                { id:'cod',    icon:'💵', label:'Cash on Delivery' },
              ].map(m => (
                <div key={m.id} className={`pay-method ${payMethod===m.id?'active':''}`} onClick={() => setPayMethod(m.id)}>
                  <span className="pay-method-icon">{m.icon}</span>
                  <span className="pay-method-label">{m.label}</span>
                </div>
              ))}
            </div>

            {payMethod === 'card' && (
              <div className="form-grid" style={{marginTop:'16px'}}>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label>Card Number</label>
                  <input placeholder="1234 5678 9012 3456" value={form.cardNum}
                    onChange={e => setForm(f=>({...f,cardNum:fmtCard(e.target.value)}))} maxLength={19} className={errors.cardNum ? 'err' : ''} />
                  {errors.cardNum && <span style={{fontSize:'0.75rem',color:'#ef4444'}}>{errors.cardNum}</span>}
                </div>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label>Cardholder Name</label>
                  <input placeholder="John Doe" value={form.cardName} onChange={set('cardName')} className={errors.cardName ? 'err' : ''} />
                  {errors.cardName && <span style={{fontSize:'0.75rem',color:'#ef4444'}}>{errors.cardName}</span>}
                </div>
                <Field id="expiry" label="Expiry (MM/YY)" placeholder="09/27" value={form.expiry} onChange={set('expiry')} errors={errors} />
                <Field id="cvv"    label="CVV" placeholder="123" value={form.cvv} onChange={set('cvv')} maxLength={4} errors={errors} />
              </div>
            )}
            {payMethod === 'paypal' && <p style={{marginTop:'14px',color:'#8b8ba7',fontSize:'0.88rem'}}>You'll be redirected to PayPal to complete your payment securely.</p>}
            {payMethod === 'apple'  && <p style={{marginTop:'14px',color:'#8b8ba7',fontSize:'0.88rem'}}>Tap the Apple Pay button on your device to authorise payment.</p>}
            {payMethod === 'google' && <p style={{marginTop:'14px',color:'#8b8ba7',fontSize:'0.88rem'}}>Complete payment using your saved Google Pay method.</p>}
            {payMethod === 'crypto' && <p style={{marginTop:'14px',color:'#8b8ba7',fontSize:'0.88rem'}}>Send exact amount in BTC/ETH to the wallet address shown after placing order.</p>}
            {payMethod === 'cod'    && <p style={{marginTop:'14px',color:'#8b8ba7',fontSize:'0.88rem'}}>Pay in cash when your order is delivered. Extra $2 COD handling fee applies.</p>}
          </div>

          {/* Order Summary */}
          <div className="form-section">
            <h3>🧾 Order Summary</h3>
            <div className="order-items-preview">
              {cart.map(item => (
                <div className="preview-item" key={item.id}>
                  <img src={item.image} alt={item.name} />
                  <span className="preview-item-name">{item.name}</span>
                  <span className="preview-item-qty">×{item.qty}</span>
                  <span className="preview-item-price">{fmt(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="checkout-totals" style={{marginTop:'14px'}}>
              <div className="total-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className="total-row"><span>Shipping</span><span>{shipping===0?'Free 🎉':fmt(shipping)}</span></div>
              <div className="total-row"><span>Tax (8%)</span><span>{fmt(tax)}</span></div>
              <div className="total-row grand"><span>Total</span><span>{fmt(total)}</span></div>
            </div>
          </div>

          <button type="submit" className="place-order-btn">
            🔒 Place Order — {fmt(total)}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   SUCCESS MODAL
══════════════════════════════════════════════ */
function SuccessModal({ ordNum, total, onClose }) {
  return (
    <div className="success-modal">
      <div className="success-card">
        <div className="success-icon">🎉</div>
        <h2>Order Placed!</h2>
        <p>Thank you! Your order has been confirmed and is being processed.</p>
        <div className="success-order-id">{ordNum}</div>
        <p style={{fontSize:'0.9rem'}}>A confirmation email will be sent shortly. Total charged: <strong style={{color:'#22d3a0'}}>{total}</strong></p>
        <button className="success-close-btn" style={{marginTop:'24px'}} onClick={onClose}>Continue Shopping →</button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   AUTH MODAL
══════════════════════════════════════════════ */
function AuthModal({ mode, onClose, onSuccess }) {
  const [isSignup, setIsSignup] = useState(mode === 'signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login'
      const payload = isSignup ? { name, email, password } : { email, password }

      const data = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onSuccess(data)
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Cannot reach backend API. On Vercel set API_URL to your Railway URL, then redeploy.'
          : err.message,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal auth-modal">
        <div className="modal-header">
          <h2>{isSignup ? 'Create account' : 'Welcome back'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form className="modal-body auth-body" onSubmit={handleSubmit}>
          {isSignup && (
            <div className="form-group">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="place-order-btn" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isSignup ? 'Sign up' : 'Login'}
          </button>
          <button
            type="button"
            className="clear-btn"
            onClick={() => setIsSignup((v) => !v)}
          >
            {isSignup ? 'Already have an account? Login' : "Don't have account? Sign up"}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════ */
export default function App() {
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('featured')
  const [cart, setCart] = useState([])
  const [wishlist, setWishlist] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [success, setSuccess] = useState(null)
  const [addedIds, setAddedIds] = useState([])
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('nova-user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('nova-token') || '')
  const [serverRatings, setServerRatings] = useState({})

  const handleImageError = (e, product) => {
    if (!e.currentTarget.dataset.fallbackApplied) {
      e.currentTarget.dataset.fallbackApplied = '1'
      e.currentTarget.src = product.fallbackImage
      return
    }
    e.currentTarget.src = `https://picsum.photos/seed/final-fallback-${product.id}/800/800`
  }

  /* derived */
  const visible = useMemo(() => {
    let list = products
    if (category !== 'All') list = list.filter(p => p.category === category)
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()))
    if (sort === 'price-asc')  list = [...list].sort((a,b) => a.price - b.price)
    if (sort === 'price-desc') list = [...list].sort((a,b) => b.price - a.price)
    if (sort === 'rating')     list = [...list].sort((a,b) => b.rating - a.rating)
    if (sort === 'name')       list = [...list].sort((a,b) => a.name.localeCompare(b.name))
    return list
  }, [category, search, sort])

  const cartCount = cart.reduce((s,i) => s+i.qty, 0)

  useEffect(() => {
    apiFetch('/api/ratings')
      .then((data) => setServerRatings(data || {}))
      .catch(() => {})
  }, [])

  /* cart ops */
  const addToCart = (product) => {
    setCart(c => {
      const ex = c.find(i => i.id === product.id)
      return ex ? c.map(i => i.id===product.id ? {...i, qty: i.qty+1} : i)
                : [...c, {...product, qty:1}]
    })
    setAddedIds(ids => [...ids, product.id])
    setTimeout(() => setAddedIds(ids => ids.filter(id => id !== product.id)), 1200)
    setCartOpen(true)
  }
  const updateQty = (id, qty) => {
    if (qty < 1) return removeItem(id)
    setCart(c => c.map(i => i.id===id ? {...i,qty} : i))
  }
  const removeItem = (id) => setCart(c => c.filter(i => i.id !== id))
  const clearCart = () => setCart([])
  const toggleWish = (id) => setWishlist(w => w.includes(id) ? w.filter(x=>x!==id) : [...w,id])

  const handleSuccess = (num, total) => {
    setCheckoutOpen(false)
    setCartOpen(false)
    clearCart()
    setSuccess({ num, total })
  }

  const openAuth = (mode) => {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  const onAuthSuccess = (data) => {
    setUser(data.user)
    setToken(data.token)
    localStorage.setItem('nova-user', JSON.stringify(data.user))
    localStorage.setItem('nova-token', data.token)
    setAuthOpen(false)
  }

  const logout = () => {
    setUser(null)
    setToken('')
    localStorage.removeItem('nova-user')
    localStorage.removeItem('nova-token')
  }

  const rateProduct = async (productId, value) => {
    if (!token) {
      openAuth('login')
      return
    }

    try {
      const data = await apiFetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, value }),
      })
      setServerRatings((current) => ({
        ...current,
        [String(productId)]: { rating: data.rating, reviews: data.reviews },
      }))
    } catch {
      alert('Could not submit rating. Please login again.')
      logout()
    }
  }

  return (
    <>
      {/* NAVBAR */}
      <nav className="navbar">
        <span className="navbar-brand">⚡ Nova Store</span>
        <div className="navbar-right">
          {user ? (
            <>
              <span className="user-pill">Hi, {user.name}</span>
              <button className="clear-btn nav-auth-btn" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <button className="clear-btn nav-auth-btn" onClick={() => openAuth('login')}>Login</button>
              <button className="checkout-btn nav-auth-btn" onClick={() => openAuth('signup')}>Sign up</button>
            </>
          )}
          <button className="cart-btn" id="cart-open-btn" onClick={() => setCartOpen(true)}>
            🛒 Cart
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-eyebrow">✨ Free shipping on orders over $100</div>
        <h1>Shop What You Love</h1>
        <p className="hero-sub">Discover curated fashion, tech & lifestyle products — all in one place.</p>
        <div className="hero-stats">
          <div className="stat"><div className="stat-num">22+</div><div className="stat-label">Products</div></div>
          <div className="stat"><div className="stat-num">6</div><div className="stat-label">Categories</div></div>
          <div className="stat"><div className="stat-num">4.7★</div><div className="stat-label">Avg Rating</div></div>
          <div className="stat"><div className="stat-num">50K+</div><div className="stat-label">Happy Customers</div></div>
        </div>
      </section>

      {/* SEARCH + SORT */}
      <div className="search-wrap">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            id="search-input"
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="featured">Featured</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="rating">Top Rated</option>
          <option value="name">A → Z</option>
        </select>
      </div>

      {/* CATEGORY FILTERS */}
      <div className="filters-wrap">
        <span className="filters-label">Filter:</span>
        {categories.map(cat => (
          <button
            key={cat}
            className={`chip ${category === cat ? 'chip-active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* RESULTS COUNT */}
      <p className="results-count">{visible.length} product{visible.length !== 1 ? 's' : ''} found</p>

      {/* PRODUCT GRID */}
      <main className="grid-wrap">
        <div className="grid">
          {visible.map((product, i) => (
            <article
              className="card"
              key={product.id}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="card-img-wrap">
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  onError={(e) => handleImageError(e, product)}
                />
                {product.badge && (
                  <span className={`card-badge ${BadgeClass(product.badge)}`}>{product.badge}</span>
                )}
                <button
                  className={`card-wishlist ${wishlist.includes(product.id) ? 'active' : ''}`}
                  onClick={() => toggleWish(product.id)}
                  title="Wishlist"
                >
                  {wishlist.includes(product.id) ? '❤️' : '🤍'}
                </button>
              </div>
              <div className="card-body">
                <p className="card-cat">{product.category}</p>
                <h2 className="card-name">{product.name}</h2>
                <div className="card-rating">
                  <span className="stars">{stars(serverRatings[String(product.id)]?.rating ?? product.rating)}</span>
                  <span className="rating-num">
                    {(serverRatings[String(product.id)]?.rating ?? product.rating).toFixed(1)} ({serverRatings[String(product.id)]?.reviews ?? product.reviews})
                  </span>
                </div>
                <div className="rate-row">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      className="rate-btn"
                      onClick={() => rateProduct(product.id, value)}
                      title={user ? `Rate ${value} star` : 'Login to rate'}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div className="card-footer">
                  <div className="price-wrap">
                    <span className="price-current">{fmt(product.price)}</span>
                    {product.originalPrice && (
                      <span className="price-original">{fmt(product.originalPrice)}</span>
                    )}
                  </div>
                  <button
                    className={`add-btn ${addedIds.includes(product.id) ? 'added' : ''}`}
                    id={`add-btn-${product.id}`}
                    onClick={() => addToCart(product)}
                  >
                    {addedIds.includes(product.id) ? '✓' : '+'} <span>Add</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <span className="footer-brand">⚡ Nova Store</span>
        <span>© 2026 Nova Store. All rights reserved.</span>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Support</a>
        </div>
      </footer>

      {/* CART DRAWER */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          onClose={() => setCartOpen(false)}
          onUpdate={updateQty}
          onRemove={removeItem}
          onClear={clearCart}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true) }}
        />
      )}

      {/* CHECKOUT */}
      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleSuccess}
        />
      )}

      {/* SUCCESS */}
      {success && (
        <SuccessModal
          ordNum={success.num}
          total={success.total}
          onClose={() => setSuccess(null)}
        />
      )}

      {authOpen && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthOpen(false)}
          onSuccess={onAuthSuccess}
        />
      )}
    </>
  )
}