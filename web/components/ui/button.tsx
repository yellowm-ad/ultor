import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border font-display font-medium whitespace-nowrap transition-all outline-none select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // 2026-11-02 — 노란 박스 대신 나무판 + 금테(app/passage.css .px-wood)
        default: 'px-wood is-primary',
        gilded: 'panel-gilded text-gold-soft hover:brightness-110',
        outline: 'border-border bg-transparent text-foreground hover:bg-muted',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'border-transparent hover:bg-muted hover:text-foreground',
        destructive: 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20',
        parchment: 'panel-parchment hover:brightness-105',
      },
      size: {
        default: 'h-9 px-3 text-sm',
        sm: 'h-7 px-2.5 text-xs',
        lg: 'h-11 px-5 text-base',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
