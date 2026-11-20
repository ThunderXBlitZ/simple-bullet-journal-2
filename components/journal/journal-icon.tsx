"use client"

import type { ComponentType } from "react"
import { Lightbulb, Music, Sprout, Star, Target } from "lucide-react"
import { ActivityIcon } from "@/components/icons/activity"
import { BookTextIcon } from "@/components/icons/book-text"
import { BrainIcon } from "@/components/icons/brain"
import { ClapIcon } from "@/components/icons/clap"
import { CoffeeIcon } from "@/components/icons/coffee"
import { DropletIcon } from "@/components/icons/droplet"
import { FlameIcon } from "@/components/icons/flame"
import { HeartIcon } from "@/components/icons/heart"
import { HeartPulseIcon } from "@/components/icons/heart-pulse"
import { LeafIcon } from "@/components/icons/leaf"
import { MoonIcon } from "@/components/icons/moon"
import { PenToolIcon } from "@/components/icons/pen-tool"
import { RocketIcon } from "@/components/icons/rocket"
import { SmileIcon } from "@/components/icons/smile"
import { SparklesIcon } from "@/components/icons/sparkles"
import { SunIcon } from "@/components/icons/sun"
import { ZapIcon } from "@/components/icons/zap"
import { EMOJI_TO_ICON, FALLBACK_ICON } from "@/lib/icon-names"

type IconComponent = ComponentType<{ size?: number; className?: string }>

/** id → component. Animated (lucide-animated) where the registry has it, else lucide-react. */
const ICONS: Record<string, IconComponent> = {
  "book-text": BookTextIcon, "heart-pulse": HeartPulseIcon, leaf: LeafIcon, droplet: DropletIcon, activity: ActivityIcon,
  "pen-tool": PenToolIcon, target: Target, moon: MoonIcon, clap: ClapIcon, heart: HeartIcon,
  lightbulb: Lightbulb, sparkles: SparklesIcon, music: Music, sprout: Sprout, star: Star,
  rocket: RocketIcon, brain: BrainIcon, coffee: CoffeeIcon, smile: SmileIcon, zap: ZapIcon, flame: FlameIcon, sun: SunIcon,
}

/** Ids offered in pickers (excludes the fallback). */
export const ICON_CHOICES = ["book-text", "heart-pulse", "leaf", "droplet", "activity", "pen-tool", "target", "moon", "clap", "heart", "lightbulb", "sparkles", "music", "sprout", "rocket", "brain"]

/** Accepts a stored icon id OR a legacy emoji; unknown values render the fallback. */
export function resolveIconName(stored: string): string {
  if (ICONS[stored]) return stored
  return EMOJI_TO_ICON[stored.replace(/\uFE0F/g, "")] ?? FALLBACK_ICON
}

export function JournalIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[resolveIconName(name)]
  return <Icon size={size} className={className ? `inline-flex shrink-0 ${className}` : "inline-flex shrink-0"} />
}
