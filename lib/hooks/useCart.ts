'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Cart, CartItem, CreateOrderResponse, Booking } from '@/types/cart'

// Mock cart data
const MOCK_CART_ITEMS: CartItem[] = [
  {
    id: '1',
    activity: {
      title: 'Catamaran Cruise to Île aux Cerfs',
      imageUrl: '/images/regions/east.jpg',
      operator: 'Blue Safari Mauritius',
    },
    slot: {
      date: '2026-04-15',
      time: '09:00',
    },
    participants: 2,
    depositAmount: 70,
    priceHT: 280,
  },
  {
    id: '2',
    activity: {
      title: 'Quad Biking Adventure',
      imageUrl: '/images/regions/south.jpg',
      operator: 'Mauritius Adventures',
    },
    slot: {
      date: '2026-04-16',
      time: '14:00',
    },
    participants: 2,
    depositAmount: 50,
    priceHT: 200,
  },
]

const MOCK_BOOKINGS: Booking[] = [
  {
    id: '1',
    bookingRef: 'MX-2026-001234',
    activityName: 'Sunset Dolphin Watching',
    date: '2026-03-20',
    time: '16:00',
    participants: 2,
    depositPaid: 60,
    balanceDue: 180,
    status: 'confirmed',
  },
  {
    id: '2',
    bookingRef: 'MX-2026-001235',
    activityName: 'Le Morne Hiking Tour',
    date: '2026-03-25',
    time: '07:00',
    participants: 1,
    depositPaid: 25,
    balanceDue: 75,
    status: 'pending',
  },
  {
    id: '3',
    bookingRef: 'MX-2026-001200',
    activityName: 'Deep Sea Fishing',
    date: '2026-02-10',
    time: '06:00',
    participants: 3,
    depositPaid: 150,
    balanceDue: 0,
    status: 'cancelled',
  },
]

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Cart hook (simulates trpc.cart.getCart)
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadCart = async () => {
      await delay(800)
      setItems(MOCK_CART_ITEMS)
      setIsLoading(false)
    }
    loadCart()
  }, [])

  const total = items.reduce((sum, item) => sum + item.depositAmount, 0)
  const totalOnSite = items.reduce(
    (sum, item) => sum + (item.priceHT - item.depositAmount),
    0
  )

  return {
    data: { items, total, totalOnSite },
    isLoading,
    setItems,
  }
}

// Remove item mutation (simulates trpc.cart.removeItem)
export function useRemoveCartItem() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = useCallback(async (itemId: string): Promise<void> => {
    setIsPending(true)
    await delay(300)
    setIsPending(false)
    // In real app, this would call the API
    return Promise.resolve()
  }, [])

  return { mutateAsync, isPending }
}

// Update participants mutation (simulates trpc.cart.updateParticipants)
export function useUpdateParticipants() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = useCallback(
    async (params: { itemId: string; participants: number }): Promise<void> => {
      setIsPending(true)
      await delay(200)
      setIsPending(false)
      return Promise.resolve()
    },
    []
  )

  return { mutateAsync, isPending }
}

// Create order mutation (simulates trpc.checkout.createOrder)
export function useCreateOrder() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = useCallback(async (): Promise<CreateOrderResponse> => {
    setIsPending(true)
    await delay(1500)
    setIsPending(false)
    return {
      orderId: `order_${Date.now()}`,
      clientSecret: `secret_${Date.now()}`,
      bookingRef: `MX-2026-${String(Math.floor(Math.random() * 900000) + 100000)}`,
    }
  }, [])

  return { mutateAsync, isPending }
}

// User type
export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  avatarUrl?: string
  role: 'tourist' | 'operator' | 'admin'
}

// Mock user for demo
const MOCK_USER: User = {
  id: '1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+230 5123 4567',
  role: 'tourist',
}

// Auth state (shared between hooks)
let authUser: User | null = MOCK_USER
const authListeners: Set<(user: User | null) => void> = new Set()

function notifyAuthListeners() {
  authListeners.forEach((listener) => listener(authUser))
}

// Auth hook (simulates trpc.auth.me)
export function useAuth() {
  const [user, setUser] = useState<User | null>(authUser)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      await delay(500)
      setUser(authUser)
      setIsLoading(false)
    }
    checkAuth()

    // Subscribe to auth changes
    const listener = (newUser: User | null) => setUser(newUser)
    authListeners.add(listener)
    return () => {
      authListeners.delete(listener)
    }
  }, [])

  return { data: user, isLoading }
}

// Login mutation (simulates trpc.auth.login)
export function useLogin() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutateAsync = useCallback(
    async (params: { email: string; password: string }): Promise<User> => {
      setIsPending(true)
      setError(null)
      await delay(1000)

      // Simulate validation
      if (params.password.length < 6) {
        setIsPending(false)
        setError('Invalid email or password')
        throw new Error('Invalid email or password')
      }

      const user: User = {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: params.email,
        phone: '+230 5123 4567',
        role: 'tourist',
      }

      authUser = user
      notifyAuthListeners()
      setIsPending(false)
      return user
    },
    []
  )

  return { mutateAsync, isPending, error }
}

// Register mutation (simulates trpc.auth.register)
export function useRegister() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutateAsync = useCallback(
    async (params: {
      firstName: string
      lastName: string
      email: string
      phone: string
      password: string
      role: 'tourist' | 'operator'
    }): Promise<User> => {
      setIsPending(true)
      setError(null)
      await delay(1500)

      const user: User = {
        id: Date.now().toString(),
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        phone: params.phone,
        role: params.role,
      }

      authUser = user
      notifyAuthListeners()
      setIsPending(false)
      return user
    },
    []
  )

  return { mutateAsync, isPending, error }
}

// Logout mutation (simulates trpc.auth.logout)
export function useLogout() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = useCallback(async (): Promise<void> => {
    setIsPending(true)
    await delay(500)
    authUser = null
    notifyAuthListeners()
    setIsPending(false)
  }, [])

  return { mutateAsync, isPending }
}

// Update profile mutation (simulates trpc.user.updateProfile)
export function useUpdateProfile() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = useCallback(
    async (params: {
      firstName: string
      lastName: string
      email: string
      phone: string
    }): Promise<User> => {
      setIsPending(true)
      await delay(800)

      if (authUser) {
        authUser = { ...authUser, ...params }
        notifyAuthListeners()
      }

      setIsPending(false)
      return authUser!
    },
    []
  )

  return { mutateAsync, isPending }
}

// Bookings hook (simulates trpc.bookings.getMyBookings)
export function useMyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadBookings = async () => {
      await delay(800)
      setBookings(MOCK_BOOKINGS)
      setIsLoading(false)
    }
    loadBookings()
  }, [])

  return { data: bookings, isLoading }
}

// =====================
// OPERATOR DASHBOARD HOOKS
// =====================

export interface OperatorStats {
  totalBookings: number
  totalRevenue: number
  platformFee: number
  occupancyRate: number
}

export interface OperatorBooking {
  id: string
  date: string
  touristName: string
  activityTitle: string
  slot: string
  participants: number
  amountHT: number
  status: 'confirmed' | 'pending' | 'cancelled'
}

export interface OperatorActivity {
  id: string
  title: string
  category: string
  region: string
  imageUrl: string
  priceHT: number
  isActive: boolean
  bookingsCount: number
}

const MOCK_OPERATOR_STATS: OperatorStats = {
  totalBookings: 156,
  totalRevenue: 24850,
  platformFee: 2485,
  occupancyRate: 78,
}

const MOCK_OPERATOR_BOOKINGS: OperatorBooking[] = [
  {
    id: '1',
    date: '2026-04-05',
    touristName: 'Marie Dupont',
    activityTitle: 'Catamaran Cruise to Île aux Cerfs',
    slot: '09:00',
    participants: 4,
    amountHT: 560,
    status: 'confirmed',
  },
  {
    id: '2',
    date: '2026-04-05',
    touristName: 'John Smith',
    activityTitle: 'Sunset Dolphin Watching',
    slot: '16:00',
    participants: 2,
    amountHT: 240,
    status: 'confirmed',
  },
  {
    id: '3',
    date: '2026-04-06',
    touristName: 'Hans Mueller',
    activityTitle: 'Quad Biking Adventure',
    slot: '10:00',
    participants: 3,
    amountHT: 300,
    status: 'pending',
  },
  {
    id: '4',
    date: '2026-04-06',
    touristName: 'Sophie Bernard',
    activityTitle: 'Catamaran Cruise to Île aux Cerfs',
    slot: '09:00',
    participants: 2,
    amountHT: 280,
    status: 'confirmed',
  },
  {
    id: '5',
    date: '2026-04-07',
    touristName: 'Carlos Rodriguez',
    activityTitle: 'Le Morne Hiking Tour',
    slot: '07:00',
    participants: 1,
    amountHT: 100,
    status: 'cancelled',
  },
  {
    id: '6',
    date: '2026-04-08',
    touristName: 'Anna Petrov',
    activityTitle: 'Sunset Dolphin Watching',
    slot: '16:00',
    participants: 4,
    amountHT: 480,
    status: 'confirmed',
  },
  {
    id: '7',
    date: '2026-04-09',
    touristName: 'Pierre Martin',
    activityTitle: 'Quad Biking Adventure',
    slot: '14:00',
    participants: 2,
    amountHT: 200,
    status: 'pending',
  },
  {
    id: '8',
    date: '2026-04-10',
    touristName: 'Elena Costa',
    activityTitle: 'Catamaran Cruise to Île aux Cerfs',
    slot: '09:00',
    participants: 6,
    amountHT: 840,
    status: 'confirmed',
  },
]

const MOCK_OPERATOR_ACTIVITIES: OperatorActivity[] = [
  {
    id: '1',
    title: 'Catamaran Cruise to Île aux Cerfs',
    category: 'Water Sports',
    region: 'East',
    imageUrl: '/images/regions/east.jpg',
    priceHT: 140,
    isActive: true,
    bookingsCount: 45,
  },
  {
    id: '2',
    title: 'Sunset Dolphin Watching',
    category: 'Nature',
    region: 'West',
    imageUrl: '/images/regions/west.jpg',
    priceHT: 120,
    isActive: true,
    bookingsCount: 32,
  },
  {
    id: '3',
    title: 'Quad Biking Adventure',
    category: 'Adventure',
    region: 'South',
    imageUrl: '/images/regions/south.jpg',
    priceHT: 100,
    isActive: true,
    bookingsCount: 28,
  },
  {
    id: '4',
    title: 'Le Morne Hiking Tour',
    category: 'Nature',
    region: 'South',
    imageUrl: '/images/regions/south.jpg',
    priceHT: 100,
    isActive: false,
    bookingsCount: 15,
  },
]

// Operator stats hook
export function useOperatorStats() {
  const [stats, setStats] = useState<OperatorStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      await delay(600)
      setStats(MOCK_OPERATOR_STATS)
      setIsLoading(false)
    }
    loadStats()
  }, [])

  return { data: stats, isLoading }
}

// Operator bookings hook
export function useOperatorBookings(page: number = 1) {
  const [bookings, setBookings] = useState<OperatorBooking[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadBookings = async () => {
      setIsLoading(true)
      await delay(500)
      const perPage = 5
      const start = (page - 1) * perPage
      const end = start + perPage
      setBookings(MOCK_OPERATOR_BOOKINGS.slice(start, end))
      setTotal(MOCK_OPERATOR_BOOKINGS.length)
      setIsLoading(false)
    }
    loadBookings()
  }, [page])

  return { data: { bookings, total }, isLoading }
}

// Operator activities hook
export function useOperatorActivities() {
  const [activities, setActivities] = useState<OperatorActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadActivities = async () => {
      await delay(500)
      setActivities(MOCK_OPERATOR_ACTIVITIES)
      setIsLoading(false)
    }
    loadActivities()
  }, [])

  const updateActivity = (id: string, updates: Partial<OperatorActivity>) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    )
  }

  return { data: activities, isLoading, updateActivity }
}

// Toggle activity mutation
export function useToggleActivity() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = useCallback(
    async (params: { activityId: string; isActive: boolean }): Promise<void> => {
      setIsPending(true)
      await delay(300)
      setIsPending(false)
    },
    []
  )

  return { mutateAsync, isPending }
}

// Create activity mutation
export function useCreateActivity() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = useCallback(
    async (params: {
      title: string
      category: string
      region: string
      shortDescription: string
      fullDescription: string
      priceHT: number
      duration: string
      maxParticipants: number
      languages: string[]
      included: string[]
      excluded: string[]
      images: string[]
      slots: Array<{ date: string; time: string; capacity: number }>
    }): Promise<{ id: string }> => {
      setIsPending(true)
      await delay(1500)
      setIsPending(false)
      return { id: Date.now().toString() }
    },
    []
  )

  return { mutateAsync, isPending }
}
