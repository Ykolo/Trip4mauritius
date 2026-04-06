'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageGalleryProps {
  images: string[]
  alt: string
}

export function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [direction, setDirection] = useState(0)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  const SWIPE_THRESHOLD = 50

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX.current

    // Only handle horizontal swipes (not vertical scrolling)
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      if (diff > 0 && currentIndex < images.length - 1) {
        // Swipe left - next image
        setDirection(1)
        setCurrentIndex(prev => prev + 1)
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - previous image
        setDirection(-1)
        setCurrentIndex(prev => prev - 1)
      }
    }
  }

  const goToImage = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1)
    setCurrentIndex(index)
  }

  const goNext = () => {
    if (currentIndex < images.length - 1) {
      setDirection(1)
      setCurrentIndex(prev => prev + 1)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setDirection(-1)
      setCurrentIndex(prev => prev - 1)
    }
  }

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0
    })
  }

  return (
    <>
      {/* Mobile Carousel */}
      <div className="md:hidden relative">
        <div
          className="relative aspect-[4/3] overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => setLightboxOpen(true)}
        >
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              <Image
                src={images[currentIndex]}
                alt={`${alt} - Image ${currentIndex + 1}`}
                fill
                className="object-cover"
                priority={currentIndex === 0}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center gap-2 py-3">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-primary' : 'bg-muted'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Desktop Grid */}
      <div className="hidden md:grid grid-cols-5 gap-3 h-[500px]">
        {/* Main image (60%) */}
        <div
          className="col-span-3 relative rounded-2xl overflow-hidden cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        >
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              <Image
                src={images[currentIndex]}
                alt={`${alt} - Main image`}
                fill
                className="object-cover"
                priority
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Thumbnail grid (40%) */}
        <div className="col-span-2 grid grid-cols-2 gap-3">
          {images.slice(0, 4).map((img, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`relative rounded-xl overflow-hidden transition-all ${
                index === currentIndex
                  ? 'ring-2 ring-primary ring-offset-2'
                  : 'hover:opacity-80'
              }`}
            >
              <Image
                src={img}
                alt={`${alt} - Thumbnail ${index + 1}`}
                fill
                className="object-cover"
              />
              {index === 3 && images.length > 4 && (
                <div className="absolute inset-0 bg-ink/60 flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    +{images.length - 4}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/95 flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors z-10"
              aria-label="Close lightbox"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation arrows */}
            {currentIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  goPrev()
                }}
                className="absolute left-4 p-3 text-white hover:bg-white/10 rounded-full transition-colors z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}
            {currentIndex < images.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  goNext()
                }}
                className="absolute right-4 p-3 text-white hover:bg-white/10 rounded-full transition-colors z-10"
                aria-label="Next image"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}

            {/* Main lightbox image */}
            <motion.div
              key={currentIndex}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl h-[80vh] mx-4"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <Image
                src={images[currentIndex]}
                alt={`${alt} - Full size ${currentIndex + 1}`}
                fill
                className="object-contain"
              />
            </motion.div>

            {/* Lightbox dots */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation()
                    goToImage(index)
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-white' : 'bg-white/40'
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
