export interface CartItemSlot {
  date: string
  time: string
}

export interface CartItemActivity {
  title: string
  imageUrl: string
  operator: string
}

export interface CartItem {
  id: string
  activity: CartItemActivity
  slot: CartItemSlot
  participants: number
  depositAmount: number
  priceHT: number
}

export interface Cart {
  items: CartItem[]
  total: number
}

export interface Booking {
  id: string
  bookingRef: string
  activityName: string
  date: string
  time: string
  participants: number
  depositPaid: number
  balanceDue: number
  status: 'confirmed' | 'pending' | 'cancelled'
}

export interface CreateOrderResponse {
  orderId: string
  clientSecret: string
  bookingRef: string
}
