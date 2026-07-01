// The `cn` helper Animate UI components import from `@/lib/utils` — clsx for conditional classes,
// tailwind-merge to dedupe conflicting Tailwind utilities. Standard shadcn/ui util.
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
