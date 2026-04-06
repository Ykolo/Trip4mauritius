'use client'

import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatsCardProps {
  label: string
  value: string | number
  icon: ReactNode
  trend?: {
    value: number
    positive: boolean
  }
}

export function StatsCard({ label, value, icon, trend }: StatsCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted mb-1">{label}</p>
          <p className="text-3xl font-bold text-ink">{value}</p>
          {trend && (
            <div
              className={`flex items-center gap-1 mt-2 text-sm ${
                trend.positive ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {trend.positive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>
                {trend.positive ? '+' : ''}
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        <div className="bg-primary/10 text-primary rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </div>
    </div>
  )
}
