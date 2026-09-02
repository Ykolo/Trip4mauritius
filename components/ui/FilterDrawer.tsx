'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import type { ActivityFilters } from '@/types/activity'

const REGIONS = ['Nord', 'Sud', 'Est', 'Ouest', 'Centre']
const DURATIONS = ['Toutes', '< 2h', 'Demi-journée', 'Journée', 'Plusieurs jours']

// Les catégories viennent de la base — la liste en dur qui vivait ici affichait
// « Sports Nautiques », « Croisières », « Bien-être », alors que la base
// contenait « Water Sports », « Cruises », « Wellness ». Cocher un filtre
// renvoyait donc zéro résultat.
//
// On coche un LIBELLÉ, on filtre sur un SLUG : le libellé est renommable depuis
// /admin/categories, le slug non.
function useCategoryOptions() {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.activity.categories.queryOptions())
  return data ?? []
}

interface FilterDrawerProps {
  filters: ActivityFilters
  onFiltersChange: (filters: ActivityFilters) => void
  onClose: () => void
  isOpen: boolean
}

export function FilterDrawer({ filters, onFiltersChange, onClose, isOpen }: FilterDrawerProps) {
  const categories = useCategoryOptions()

  const handleRegionToggle = (region: string) => {
    const current = filters.region || []
    const updated = current.includes(region)
      ? current.filter(r => r !== region)
      : [...current, region]
    onFiltersChange({ ...filters, region: updated, page: 1 })
  }

  const handleCategoryToggle = (category: string) => {
    const current = filters.category || []
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category]
    onFiltersChange({ ...filters, category: updated, page: 1 })
  }

  const handleDurationChange = (duration: string) => {
    onFiltersChange({ ...filters, duration: duration === 'Toutes' ? undefined : duration, page: 1 })
  }

  const handleLanguageToggle = (lang: string) => {
    const current = filters.lang || []
    const updated = current.includes(lang)
      ? current.filter(l => l !== lang)
      : [...current, lang]
    onFiltersChange({ ...filters, lang: updated, page: 1 })
  }

  const handlePriceChange = (min: number, max: number) => {
    onFiltersChange({ ...filters, minPrice: min, maxPrice: max, page: 1 })
  }

  const handleReset = () => {
    onFiltersChange({ page: 1 })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto pb-safe"
          >
            {/* Handle bar */}
            <div className="sticky top-0 bg-white pt-3 pb-2">
              <div className="w-12 h-1 rounded-full bg-muted mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-ink text-center">Filtres</h2>
            </div>
            
            <div className="px-6 pb-6 space-y-6">
              {/* Region */}
              <FilterSection title="Région">
                <div className="flex flex-wrap gap-2">
                  {REGIONS.map(region => (
                    <CheckboxChip
                      key={region}
                      label={region}
                      checked={(filters.region || []).includes(region)}
                      onChange={() => handleRegionToggle(region)}
                    />
                  ))}
                </div>
              </FilterSection>
              
              {/* Category */}
              <FilterSection title="Catégorie">
                <div className="flex flex-wrap gap-2">
                  {categories.map(category => (
                    <CheckboxChip
                      key={category.slug}
                      label={category.label}
                      checked={(filters.category || []).includes(category.slug)}
                      onChange={() => handleCategoryToggle(category.slug)}
                    />
                  ))}
                </div>
              </FilterSection>
              
              {/* Price Range */}
              <FilterSection title="Fourchette de Prix">
                <PriceRangeSlider
                  min={filters.minPrice || 0}
                  max={filters.maxPrice || 500}
                  onChange={handlePriceChange}
                />
              </FilterSection>
              
              {/* Duration */}
              <FilterSection title="Durée">
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map(duration => (
                    <RadioChip
                      key={duration}
                      label={duration}
                      checked={(filters.duration || 'Toutes') === duration || (duration === 'Toutes' && !filters.duration)}
                      onChange={() => handleDurationChange(duration)}
                    />
                  ))}
                </div>
              </FilterSection>
              
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-surface px-6 py-4 flex gap-4">
              <button
                onClick={handleReset}
                className="text-muted font-medium py-3 px-4"
              >
                Réinitialiser
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-primary text-white rounded-2xl py-3 font-medium active:scale-[0.98] transition-transform"
              >
                Appliquer les filtres
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Filter section wrapper
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink mb-3">{title}</h3>
      {children}
    </div>
  )
}

// Checkbox chip component
function CheckboxChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        checked
          ? 'bg-primary text-white'
          : 'bg-surface text-ink hover:bg-muted/20'
      }`}
    >
      {label}
    </button>
  )
}

// Radio chip component
function RadioChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        checked
          ? 'bg-primary text-white'
          : 'bg-surface text-ink hover:bg-muted/20'
      }`}
    >
      {label}
    </button>
  )
}

// Price range slider
function PriceRangeSlider({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm text-muted">
        <span>€{min}</span>
        <span>€{max}</span>
      </div>
      <div className="flex gap-4">
        <input
          type="range"
          min={0}
          max={500}
          value={min}
          onChange={(e) => onChange(Number(e.target.value), max)}
          className="flex-1 accent-primary"
        />
        <input
          type="range"
          min={0}
          max={500}
          value={max}
          onChange={(e) => onChange(min, Number(e.target.value))}
          className="flex-1 accent-primary"
        />
      </div>
    </div>
  )
}

// Desktop sidebar version
export function FilterSidebar({ filters, onFiltersChange }: Omit<FilterDrawerProps, 'onClose' | 'isOpen'>) {
  const categories = useCategoryOptions()

  const handleRegionToggle = (region: string) => {
    const current = filters.region || []
    const updated = current.includes(region)
      ? current.filter(r => r !== region)
      : [...current, region]
    onFiltersChange({ ...filters, region: updated, page: 1 })
  }

  const handleCategoryToggle = (category: string) => {
    const current = filters.category || []
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category]
    onFiltersChange({ ...filters, category: updated, page: 1 })
  }

  const handleDurationChange = (duration: string) => {
    onFiltersChange({ ...filters, duration: duration === 'Toutes' ? undefined : duration, page: 1 })
  }

  const handleLanguageToggle = (lang: string) => {
    const current = filters.lang || []
    const updated = current.includes(lang)
      ? current.filter(l => l !== lang)
      : [...current, lang]
    onFiltersChange({ ...filters, lang: updated, page: 1 })
  }

  const handlePriceChange = (min: number, max: number) => {
    onFiltersChange({ ...filters, minPrice: min, maxPrice: max, page: 1 })
  }

  const handleReset = () => {
    onFiltersChange({ page: 1 })
  }

  return (
    <div className="sticky top-20 bg-white rounded-2xl shadow-card p-6 space-y-6 h-fit">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Filtres</h2>
        <button
          onClick={handleReset}
          className="text-sm text-muted hover:text-primary transition-colors"
        >
          Réinitialiser
        </button>
      </div>
      
      {/* Region */}
      <FilterSection title="Région">
        <div className="space-y-2">
          {REGIONS.map(region => (
            <label key={region} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(filters.region || []).includes(region)}
                onChange={() => handleRegionToggle(region)}
                className="w-4 h-4 rounded border-muted accent-primary"
              />
              <span className="text-sm text-ink">{region}</span>
            </label>
          ))}
        </div>
      </FilterSection>
      
      {/* Category */}
      <FilterSection title="Catégorie">
        <div className="space-y-2">
          {categories.map(category => (
            <label key={category.slug} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(filters.category || []).includes(category.slug)}
                onChange={() => handleCategoryToggle(category.slug)}
                className="w-4 h-4 rounded border-muted accent-primary"
              />
              <span className="text-sm text-ink">{category.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>
      
      {/* Price Range */}
      <FilterSection title="Fourchette de Prix">
        <PriceRangeSlider
          min={filters.minPrice || 0}
          max={filters.maxPrice || 500}
          onChange={handlePriceChange}
        />
      </FilterSection>
      
      {/* Duration */}
      <FilterSection title="Durée">
        <div className="space-y-2">
          {DURATIONS.map(duration => (
            <label key={duration} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="duration"
                checked={(filters.duration || 'Toutes') === duration || (duration === 'Toutes' && !filters.duration)}
                onChange={() => handleDurationChange(duration)}
                className="w-4 h-4 border-muted accent-primary"
              />
              <span className="text-sm text-ink">{duration}</span>
            </label>
          ))}
        </div>
      </FilterSection>
    </div>
  )
}
