'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Upload,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Users,
  Image as ImageIcon,
} from 'lucide-react'
import { useCreateActivity } from '@/lib/hooks/useCart'

const CATEGORIES = [
  'Water Sports',
  'Nature',
  'Adventure',
  'Cultural',
  'Wellness',
  'Gastronomy',
  'Nightlife',
  'Family',
]

const REGIONS = ['North', 'South', 'East', 'West', 'Centre']

const DURATIONS = [
  '1 hour',
  '2 hours',
  '3 hours',
  'Half day (4h)',
  'Full day (8h)',
  '2 days',
]

const LANGUAGES = [
  { code: 'FR', label: 'French' },
  { code: 'EN', label: 'English' },
  { code: 'DE', label: 'German' },
  { code: 'ES', label: 'Spanish' },
  { code: 'RU', label: 'Russian' },
]

interface FormData {
  // Step 1
  title: string
  category: string
  region: string
  shortDescription: string
  fullDescription: string
  // Step 2
  priceHT: number
  duration: string
  maxParticipants: number
  languages: string[]
  included: string[]
  excluded: string[]
  // Step 3
  images: string[]
  // Step 4
  slots: Array<{ date: string; time: string; capacity: number }>
}

const initialFormData: FormData = {
  title: '',
  category: '',
  region: '',
  shortDescription: '',
  fullDescription: '',
  priceHT: 0,
  duration: '',
  maxParticipants: 10,
  languages: ['EN'],
  included: [''],
  excluded: [''],
  images: [],
  slots: [{ date: '', time: '09:00', capacity: 10 }],
}

interface ActivityFormProps {
  onSuccess?: () => void
}

export function ActivityForm({ onSuccess }: ActivityFormProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { mutateAsync: createActivity, isPending } = useCreateActivity()

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    )
    processFiles(files)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    processFiles(files)
  }

  const processFiles = (files: File[]) => {
    const maxFiles = 10 - formData.images.length
    const filesToProcess = files.slice(0, maxFiles)

    filesToProcess.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, base64],
        }))
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }))
  }

  const addIncludedItem = () => {
    setFormData((prev) => ({ ...prev, included: [...prev.included, ''] }))
  }

  const removeIncludedItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      included: prev.included.filter((_, i) => i !== index),
    }))
  }

  const updateIncludedItem = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      included: prev.included.map((item, i) => (i === index ? value : item)),
    }))
  }

  const addExcludedItem = () => {
    setFormData((prev) => ({ ...prev, excluded: [...prev.excluded, ''] }))
  }

  const removeExcludedItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      excluded: prev.excluded.filter((_, i) => i !== index),
    }))
  }

  const updateExcludedItem = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      excluded: prev.excluded.map((item, i) => (i === index ? value : item)),
    }))
  }

  const addSlot = () => {
    setFormData((prev) => ({
      ...prev,
      slots: [...prev.slots, { date: '', time: '09:00', capacity: formData.maxParticipants }],
    }))
  }

  const removeSlot = (index: number) => {
    if (formData.slots.length > 1) {
      setFormData((prev) => ({
        ...prev,
        slots: prev.slots.filter((_, i) => i !== index),
      }))
    }
  }

  const updateSlot = (
    index: number,
    field: 'date' | 'time' | 'capacity',
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      slots: prev.slots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      ),
    }))
  }

  const toggleLanguage = (code: string) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.includes(code)
        ? prev.languages.filter((l) => l !== code)
        : [...prev.languages, code],
    }))
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return (
          formData.title.trim() &&
          formData.category &&
          formData.region &&
          formData.shortDescription.trim()
        )
      case 2:
        return (
          formData.priceHT > 0 &&
          formData.duration &&
          formData.maxParticipants > 0 &&
          formData.languages.length > 0
        )
      case 3:
        return formData.images.length >= 3
      case 4:
        return (
          formData.slots.length >= 1 &&
          formData.slots.every((s) => s.date && s.time && s.capacity > 0)
        )
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    try {
      await createActivity({
        title: formData.title,
        category: formData.category,
        region: formData.region,
        shortDescription: formData.shortDescription,
        fullDescription: formData.fullDescription,
        priceHT: formData.priceHT,
        duration: formData.duration,
        maxParticipants: formData.maxParticipants,
        languages: formData.languages,
        included: formData.included.filter(Boolean),
        excluded: formData.excluded.filter(Boolean),
        images: formData.images,
        slots: formData.slots,
      })
      onSuccess?.()
      setFormData(initialFormData)
      setStep(1)
    } catch {
      // Handle error
    }
  }

  const steps = [
    { number: 1, label: 'Basic Info' },
    { number: 2, label: 'Details' },
    { number: 3, label: 'Photos' },
    { number: 4, label: 'Availability' },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => (
          <div key={s.number} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                step > s.number
                  ? 'bg-primary text-white'
                  : step === s.number
                  ? 'bg-primary text-white'
                  : 'bg-surface text-muted'
              }`}
            >
              {step > s.number ? <Check className="w-5 h-5" /> : s.number}
            </div>
            <span
              className={`ml-2 text-sm hidden sm:block ${
                step >= s.number ? 'text-ink font-medium' : 'text-muted'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`w-8 sm:w-16 h-0.5 mx-2 sm:mx-4 ${
                  step > s.number ? 'bg-primary' : 'bg-surface'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form Steps */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step 1 - Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Activity Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="e.g., Sunset Catamaran Cruise"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Region *
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) => updateField('region', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">Select region</option>
                    {REGIONS.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Short Description * ({formData.shortDescription.length}/150)
                </label>
                <textarea
                  value={formData.shortDescription}
                  onChange={(e) =>
                    updateField('shortDescription', e.target.value.slice(0, 150))
                  }
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  placeholder="Brief description for activity cards..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Full Description
                </label>
                <textarea
                  value={formData.fullDescription}
                  onChange={(e) => updateField('fullDescription', e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  placeholder="Detailed description with formatting (use line breaks for paragraphs)..."
                />
                <p className="text-xs text-muted mt-1">
                  Use line breaks to separate paragraphs
                </p>
              </div>
            </div>
          )}

          {/* Step 2 - Details */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Price HT (EUR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.priceHT || ''}
                    onChange={(e) =>
                      updateField('priceHT', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Duration *
                  </label>
                  <select
                    value={formData.duration}
                    onChange={(e) => updateField('duration', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">Select duration</option>
                    {DURATIONS.map((dur) => (
                      <option key={dur} value={dur}>
                        {dur}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Max Participants *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxParticipants}
                    onChange={(e) =>
                      updateField('maxParticipants', parseInt(e.target.value) || 1)
                    }
                    className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Languages *
                </label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => toggleLanguage(lang.code)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        formData.languages.includes(lang.code)
                          ? 'bg-primary text-white'
                          : 'bg-surface text-muted hover:bg-surface/80'
                      }`}
                    >
                      {lang.code} - {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-ink">
                    What&apos;s Included
                  </label>
                  <button
                    type="button"
                    onClick={addIncludedItem}
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.included.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateIncludedItem(index, e.target.value)}
                        className="flex-1 px-4 py-2 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        placeholder="e.g., Lunch, Equipment, Guide..."
                      />
                      {formData.included.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeIncludedItem(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-ink">
                    What&apos;s Not Included
                  </label>
                  <button
                    type="button"
                    onClick={addExcludedItem}
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.excluded.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateExcludedItem(index, e.target.value)}
                        className="flex-1 px-4 py-2 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        placeholder="e.g., Transportation, Tips..."
                      />
                      {formData.excluded.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeExcludedItem(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3 - Photos */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Activity Photos ({formData.images.length}/10)
                </label>
                <p className="text-sm text-muted mb-4">
                  Upload 3-10 photos. WebP format recommended for best performance.
                </p>

                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-surface hover:border-primary/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="w-12 h-12 text-muted mx-auto mb-4" />
                  <p className="text-ink font-medium">
                    Drag & drop images here, or click to browse
                  </p>
                  <p className="text-sm text-muted mt-1">
                    PNG, JPG, WebP up to 10MB each
                  </p>
                </div>
              </div>

              {formData.images.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {formData.images.map((img, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-xl overflow-hidden bg-surface group"
                    >
                      <img
                        src={img}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {index === 0 && (
                        <span className="absolute bottom-2 left-2 px-2 py-1 bg-primary text-white text-xs rounded-lg">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}
                  {formData.images.length < 10 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-surface hover:border-primary/50 flex flex-col items-center justify-center text-muted hover:text-primary transition-colors"
                    >
                      <ImageIcon className="w-8 h-8 mb-2" />
                      <span className="text-sm">Add more</span>
                    </button>
                  )}
                </div>
              )}

              {formData.images.length < 3 && (
                <p className="text-sm text-amber-600">
                  Please upload at least 3 photos to continue
                </p>
              )}
            </div>
          )}

          {/* Step 4 - Availability */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-ink">
                  Available Time Slots
                </label>
                <button
                  type="button"
                  onClick={addSlot}
                  className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                >
                  <Plus className="w-4 h-4" />
                  Add Slot
                </button>
              </div>

              <div className="space-y-3">
                {formData.slots.map((slot, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-3 p-4 bg-surface rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-muted" />
                      <input
                        type="date"
                        value={slot.date}
                        onChange={(e) => updateSlot(index, 'date', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="px-3 py-2 rounded-lg border border-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-muted" />
                      <input
                        type="time"
                        value={slot.time}
                        onChange={(e) => updateSlot(index, 'time', e.target.value)}
                        className="px-3 py-2 rounded-lg border border-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-muted" />
                      <input
                        type="number"
                        min="1"
                        value={slot.capacity}
                        onChange={(e) =>
                          updateSlot(index, 'capacity', parseInt(e.target.value) || 1)
                        }
                        className="w-20 px-3 py-2 rounded-lg border border-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                      <span className="text-sm text-muted">pax</span>
                    </div>

                    {formData.slots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlot(index)}
                        className="ml-auto p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-sm text-muted">
                At least one slot with a valid date is required to publish the activity.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-surface">
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className="flex items-center gap-2 px-6 py-3 text-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed() || isPending}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Create Activity
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
