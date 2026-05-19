import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const MONGO_URI = process.env.MONGO_URI
const JWT_SECRET = process.env.JWT_SECRET
let useMemoryStore = false
const memoryUsers = []
const memoryRatings = []

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const isAllowedOrigin = (origin) => {
  if (!origin) return true
  if (allowedOrigins.includes(origin)) return true
  try {
    const { hostname, protocol } = new URL(origin)
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    if (protocol === 'https:' && (hostname.endsWith('.vercel.app') || hostname === 'vercel.app')) {
      return true
    }
  } catch {
    return false
  }
  return false
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, origin || true)
      } else {
        callback(null, false)
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)
app.options(/.*/, cors())
app.use(express.json())

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
)

const ratingSchema = new mongoose.Schema(
  {
    productId: { type: Number, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    value: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true },
)

ratingSchema.index({ productId: 1, userId: 1 }, { unique: true })

const User = mongoose.model('User', userSchema)
const Rating = mongoose.model('Rating', ratingSchema)

const auth = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ message: 'Missing token' })
    }

    const payload = jwt.verify(token, JWT_SECRET)
    let user = null
    if (useMemoryStore) {
      user = memoryUsers.find((item) => item._id === payload.userId) || null
    } else {
      user = await User.findById(payload.userId).select('_id name email')
    }
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

const signToken = (user) =>
  jwt.sign({ userId: user._id.toString(), email: user.email }, JWT_SECRET, {
    expiresIn: '7d',
  })

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, store: useMemoryStore ? 'memory' : 'mongo' })
})

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name = '', email = '', password = '' } = req.body
    if (!name.trim() || !email.trim() || password.length < 6) {
      return res.status(400).json({ message: 'Name, valid email and 6+ char password required' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const existing = useMemoryStore
      ? memoryUsers.find((item) => item.email === normalizedEmail)
      : await User.findOne({ email: normalizedEmail })
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    let user
    if (useMemoryStore) {
      user = {
        _id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      }
      memoryUsers.push(user)
    } else {
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      })
    }

    const token = signToken(user)
    return res.status(201).json({
      token,
      user: { id: user._id.toString(), name: user.name, email: user.email },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Signup failed', detail: error.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email = '', password = '' } = req.body
    const normalizedEmail = email.toLowerCase().trim()
    const user = useMemoryStore
      ? memoryUsers.find((item) => item.email === normalizedEmail)
      : await User.findOne({ email: normalizedEmail })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const token = signToken(user)
    return res.json({
      token,
      user: { id: user._id.toString(), name: user.name, email: user.email },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', detail: error.message })
  }
})

app.get('/api/ratings', async (_req, res) => {
  try {
    let mapped = {}
    if (useMemoryStore) {
      const grouped = memoryRatings.reduce((acc, item) => {
        if (!acc[item.productId]) {
          acc[item.productId] = []
        }
        acc[item.productId].push(item.value)
        return acc
      }, {})
      mapped = Object.fromEntries(
        Object.entries(grouped).map(([key, values]) => [
          String(key),
          {
            rating: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)),
            reviews: values.length,
          },
        ]),
      )
    } else {
      const stats = await Rating.aggregate([
        {
          $group: {
            _id: '$productId',
            avg: { $avg: '$value' },
            count: { $sum: 1 },
          },
        },
      ])
      mapped = Object.fromEntries(
        stats.map((item) => [
          String(item._id),
          { rating: Number(item.avg.toFixed(1)), reviews: item.count },
        ]),
      )
    }

    return res.json(mapped)
  } catch (error) {
    return res.status(500).json({ message: 'Could not fetch ratings', detail: error.message })
  }
})

app.post('/api/ratings', auth, async (req, res) => {
  try {
    const productId = Number(req.body.productId)
    const value = Number(req.body.value)
    if (!Number.isFinite(productId) || ![1, 2, 3, 4, 5].includes(value)) {
      return res.status(400).json({ message: 'Invalid rating payload' })
    }

    let current
    if (useMemoryStore) {
      const existingIndex = memoryRatings.findIndex(
        (item) => item.productId === productId && item.userId === req.user._id,
      )
      if (existingIndex >= 0) {
        memoryRatings[existingIndex].value = value
      } else {
        memoryRatings.push({ productId, userId: req.user._id, value })
      }
      const ratings = memoryRatings.filter((item) => item.productId === productId).map((item) => item.value)
      current = {
        avg: ratings.reduce((sum, item) => sum + item, 0) / ratings.length,
        count: ratings.length,
      }
    } else {
      await Rating.findOneAndUpdate(
        { productId, userId: req.user._id },
        { productId, userId: req.user._id, value },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      const summary = await Rating.aggregate([
        { $match: { productId } },
        { $group: { _id: '$productId', avg: { $avg: '$value' }, count: { $sum: 1 } } },
      ])
      current = summary[0] || { avg: value, count: 1 }
    }

    return res.status(201).json({
      productId,
      rating: Number(current.avg.toFixed(1)),
      reviews: current.count,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Could not save rating', detail: error.message })
  }
})

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found' })
})

app.get('/', (_req, res) => {
  res.json({ ok: true, message: 'Ecommerce API', health: '/api/health' })
})

const start = async () => {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is required. Set it in your environment variables.')
    process.exit(1)
  }
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    useMemoryStore = false
    console.log('Connected to MongoDB')
  } catch (error) {
    useMemoryStore = true
    console.warn(`MongoDB unavailable (${error.message}). Using in-memory store.`)
  }
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`)
  })
}

start().catch((error) => {
  console.error('Server start failed:', error.message)
  console.error('Make sure MongoDB is running and MONGO_URI is valid.')
  process.exit(1)
})
