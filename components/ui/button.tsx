import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const variants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40', { variants: { variant: { default: 'bg-[#0071e3] text-white hover:bg-[#0077ed] shadow-[0_4px_16px_#0071e325]', outline: 'border border-stone-200 bg-white hover:bg-stone-50 text-stone-700', ghost: 'hover:bg-stone-100 text-stone-600', danger: 'bg-red-50 text-red-700 hover:bg-red-100' }, size: { default: 'h-11 px-5', sm: 'h-9 px-3 text-xs', lg: 'h-12 px-6' } }, defaultVariants: { variant: 'default', size: 'default' } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => { const Comp = asChild ? Slot : 'button'; return <Comp ref={ref} className={cn(variants({variant,size,className}))} {...props}/>; });
Button.displayName = 'Button';
