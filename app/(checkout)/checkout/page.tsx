'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useCart, useCreateOrder } from '@/lib/hooks/useCart'

type Step = 1 | 2 | 3

interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  createAccount: boolean
  password: string
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { num: 1, label: 'Details' },
    { num: 2, label: 'Payment' },
    { num: 3, label: 'Confirmed' },
  ]

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
              currentStep > step.num
                ? 'bg-green-500 text-white'
                : currentStep === step.num
                  ? 'bg-primary text-white'
                  : 'bg-muted/20 text-muted'
            }`}
          >
            {currentStep > step.num ? (
              <Check className="w-5 h-5" />
            ) : (
              step.num
            )}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-12 h-1 mx-2 rounded transition-colors ${
                currentStep > step.num ? 'bg-green-500' : 'bg-muted/20'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default function CheckoutPage() {
  const [step, setStep] = useState<Step>(1)
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false)
  const [bookingRef, setBookingRef] = useState('')
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    createAccount: false,
    password: '',
  })
  const [errors, setErrors] = useState<Partial<FormData>>({})

  const { data: cart } = useCart()
  const createOrder = useCreateOrder()

  const validateStep1 = (): boolean => {
    const newErrors: Partial<FormData> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address'
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required'
    }
    if (formData.createAccount && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleContinue = () => {
    if (validateStep1()) {
      setStep(2)
    }
  }

  const handlePay = async () => {
    const result = await createOrder.mutateAsync()
    setBookingRef(result.bookingRef)
    setStep(3)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    // Clear error when user types
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  return (
    <div className="min-h-screen bg-base py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink text-center mb-6">
          Checkout
        </h1>

        <StepIndicator currentStep={step} />

        <AnimatePresence mode="wait">
          {/* Step 1: Your Details */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl shadow-card p-6"
            >
              <h2 className="text-lg font-semibold text-ink mb-4">
                Your Details
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="block text-sm font-medium text-ink mb-1"
                    >
                      First Name *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        errors.firstName ? 'border-red-500' : 'border-surface'
                      } bg-base focus:outline-none focus:ring-2 focus:ring-primary/20`}
                      required
                    />
                    {errors.firstName && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.firstName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="lastName"
                      className="block text-sm font-medium text-ink mb-1"
                    >
                      Last Name *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        errors.lastName ? 'border-red-500' : 'border-surface'
                      } bg-base focus:outline-none focus:ring-2 focus:ring-primary/20`}
                      required
                    />
                    {errors.lastName && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-ink mb-1"
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      errors.email ? 'border-red-500' : 'border-surface'
                    } bg-base focus:outline-none focus:ring-2 focus:ring-primary/20`}
                    required
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-ink mb-1"
                  >
                    Phone *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      errors.phone ? 'border-red-500' : 'border-surface'
                    } bg-base focus:outline-none focus:ring-2 focus:ring-primary/20`}
                    required
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="createAccount"
                    name="createAccount"
                    checked={formData.createAccount}
                    onChange={handleInputChange}
                    className="w-5 h-5 rounded border-surface text-primary focus:ring-primary"
                  />
                  <label htmlFor="createAccount" className="text-sm text-ink">
                    Create an account to track your bookings
                  </label>
                </div>

                {formData.createAccount && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-ink mb-1"
                    >
                      Password *
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      minLength={8}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        errors.password ? 'border-red-500' : 'border-surface'
                      } bg-base focus:outline-none focus:ring-2 focus:ring-primary/20`}
                    />
                    {errors.password && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.password}
                      </p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      At least 8 characters
                    </p>
                  </motion.div>
                )}
              </div>

              <button
                onClick={handleContinue}
                className="w-full mt-6 bg-primary text-white font-semibold py-4 rounded-2xl active:scale-95 transition-transform"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Order Summary Accordion (mobile) */}
              <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                <button
                  onClick={() => setOrderSummaryOpen(!orderSummaryOpen)}
                  className="w-full px-6 py-4 flex items-center justify-between"
                >
                  <span className="font-semibold text-ink">Order Summary</span>
                  <div className="flex items-center gap-2">
                    <span className="text-accent font-bold">
                      &euro;{cart.total}
                    </span>
                    {orderSummaryOpen ? (
                      <ChevronUp className="w-5 h-5 text-muted" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {orderSummaryOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 space-y-3">
                        {cart.items.map((item) => (
                          <div key={item.id} className="flex gap-3">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                              <Image
                                src={item.activity.imageUrl}
                                alt={item.activity.title}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink truncate">
                                {item.activity.title}
                              </p>
                              <p className="text-xs text-muted">
                                {item.participants} person(s)
                              </p>
                            </div>
                            <p className="text-sm font-medium text-ink">
                              &euro;{item.depositAmount}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Payment Card */}
              <div className="bg-white rounded-2xl shadow-card p-6">
                <h2 className="text-lg font-semibold text-ink mb-4">
                  Payment Details
                </h2>

                {/* Stripe placeholder */}
                <div
                  id="stripe-card-element"
                  className="border border-surface rounded-2xl p-4 bg-base min-h-[120px] flex items-center justify-center"
                >
                  <p className="text-muted text-sm text-center">
                    (Stripe Elements will be mounted here)
                  </p>
                </div>

                {/* Price breakdown */}
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted">Deposit due now</span>
                    <span className="text-accent font-bold text-lg">
                      &euro;{cart.total}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Balance on-site</span>
                    <span className="text-muted">
                      &euro;{cart.totalOnSite}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handlePay}
                  disabled={createOrder.isPending}
                  className="w-full mt-6 bg-primary text-white font-semibold py-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {createOrder.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Pay €${cart.total} Now`
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-card p-6 text-center"
            >
              {/* Success checkmark */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <Check className="w-10 h-10 text-white" />
              </motion.div>

              <h2 className="text-2xl font-display text-ink mb-2">
                Booking Confirmed!
              </h2>
              <p className="text-muted mb-6">
                Your adventure in Mauritius awaits
              </p>

              {/* Booking reference */}
              <div className="bg-base rounded-xl px-6 py-4 inline-block mb-6">
                <p className="text-xs text-muted mb-1">Booking Reference</p>
                <p className="font-mono text-xl font-bold text-ink">
                  {bookingRef}
                </p>
              </div>

              {/* Cart items summary */}
              <div className="border-t border-surface pt-6 mb-6">
                <h3 className="text-sm font-semibold text-ink mb-3 text-left">
                  Your Activities
                </h3>
                <div className="space-y-2">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-muted truncate flex-1 text-left">
                        {item.activity.title}
                      </span>
                      <span className="text-ink font-medium ml-2">
                        {item.participants} pax
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/bookings"
                  className="flex-1 bg-primary text-white font-semibold py-4 rounded-2xl active:scale-95 transition-transform text-center"
                >
                  View My Bookings
                </Link>
                <Link
                  href="/"
                  className="flex-1 bg-surface text-ink font-semibold py-4 rounded-2xl active:scale-95 transition-transform text-center"
                >
                  Continue Exploring
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
