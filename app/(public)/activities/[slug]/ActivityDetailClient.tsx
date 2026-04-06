'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Clock, Users, Globe, Star, BadgeCheck, Check, X } from 'lucide-react'
import { ImageGallery } from '@/components/ui/ImageGallery'
import { SlotSelector } from '@/components/ui/SlotSelector'
import { PriceBreakdown } from '@/components/ui/PriceBreakdown'
import type { ActivityFull } from '@/types/activity'

interface ActivityDetailClientProps {
  activity: ActivityFull
}

type LanguageCode = 'fr' | 'en' | 'de' | 'es' | 'ru'

const languageLabels: Record<LanguageCode, string> = {
  fr: 'FR',
  en: 'EN',
  de: 'DE',
  es: 'ES',
  ru: 'RU'
}

export function ActivityDetailClient({ activity }: ActivityDetailClientProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [activeLanguage, setActiveLanguage] = useState<LanguageCode>('en')

  return (
    <div className="pb-32 md:pb-8">
      {/* Breadcrumb */}
      <nav className="px-4 py-3 text-sm" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-muted">
          <li>
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
          </li>
          <ChevronRight className="w-4 h-4" />
          <li>
            <Link href="/activities" className="hover:text-primary transition-colors">
              Activities
            </Link>
          </li>
          <ChevronRight className="w-4 h-4" />
          <li className="text-ink font-medium truncate max-w-[200px]">
            {activity.title}
          </li>
        </ol>
      </nav>

      {/* Image Gallery */}
      <section className="md:px-4">
        <ImageGallery images={activity.imageUrls} alt={activity.title} />
      </section>

      <div className="px-4 mt-6">
        <div className="md:grid md:grid-cols-3 md:gap-8">
          {/* Main content (left 2/3 on desktop) */}
          <div className="md:col-span-2">
            {/* Title + badges */}
            <div className="mb-4">
              <h1 className="font-display text-3xl text-ink mb-2">{activity.title}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  {activity.region}
                </span>
                <span className="bg-muted/30 text-ink px-3 py-1 rounded-full text-sm">
                  {activity.category}
                </span>
                {activity.rating && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="w-4 h-4 fill-accent text-accent" />
                    <span className="font-medium">{activity.rating}</span>
                    <span className="text-muted">({activity.reviewCount} reviews)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info chips row */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="flex items-center gap-1 bg-base rounded-full px-3 py-1 text-sm">
                <Clock className="w-4 h-4 text-muted" />
                {activity.duration}
              </span>
              <span className="flex items-center gap-1 bg-base rounded-full px-3 py-1 text-sm">
                <Globe className="w-4 h-4 text-muted" />
                {activity.languages.join(', ')}
              </span>
              <span className="flex items-center gap-1 bg-base rounded-full px-3 py-1 text-sm">
                <Users className="w-4 h-4 text-muted" />
                Max {activity.maxParticipants} participants
              </span>
            </div>

            {/* Operator card */}
            <div className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-muted/20 mb-6">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image
                  src={activity.operator.avatarUrl}
                  alt={activity.operator.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <p className="font-semibold text-ink">{activity.operator.name}</p>
                {activity.operator.verified && (
                  <div className="flex items-center gap-1 text-accent text-sm">
                    <BadgeCheck className="w-4 h-4" />
                    Verified Operator
                  </div>
                )}
              </div>
            </div>

            {/* Description with language tabs */}
            <section className="mb-6">
              <h2 className="font-semibold text-xl text-ink mb-3">Description</h2>
              
              {/* Language tabs */}
              <div className="flex gap-1 mb-4 border-b border-muted/30">
                {(Object.keys(activity.description) as LanguageCode[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveLanguage(lang)}
                    className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                      activeLanguage === lang
                        ? 'text-primary'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {languageLabels[lang]}
                    {activeLanguage === lang && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </button>
                ))}
              </div>
              
              {/* Description content */}
              <p className="text-ink leading-relaxed">
                {activity.description[activeLanguage]}
              </p>
            </section>

            {/* Included / Excluded */}
            <section className="mb-6">
              <h2 className="font-semibold text-xl text-ink mb-3">What&apos;s included</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Included */}
                <div>
                  <ul className="space-y-2">
                    {activity.included.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-ink">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Excluded */}
                <div>
                  <h3 className="font-medium text-ink mb-2 md:sr-only">Not included</h3>
                  <ul className="space-y-2">
                    {activity.excluded.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Slot Selector */}
            <SlotSelector
              slots={activity.slots}
              selectedSlotId={selectedSlotId}
              onSelect={setSelectedSlotId}
            />
          </div>

          {/* Price breakdown sidebar (right 1/3 on desktop) */}
          <div className="hidden md:block">
            <PriceBreakdown
              priceHT={activity.priceHT}
              maxParticipants={activity.maxParticipants}
              selectedSlotId={selectedSlotId}
              activityId={activity.id}
            />
          </div>
        </div>
      </div>

      {/* Mobile price bar */}
      <div className="md:hidden">
        <PriceBreakdown
          priceHT={activity.priceHT}
          maxParticipants={activity.maxParticipants}
          selectedSlotId={selectedSlotId}
          activityId={activity.id}
        />
      </div>
    </div>
  )
}
