import {ButtonHTMLAttributes, forwardRef} from 'react'
import {motion} from 'framer-motion'
import {cn} from '@/utils/cn.ts'
// @ts-ignore
import {playClickSound, playHoverSound} from '@/utils/audioEffects.ts'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | 'warning'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon'
    loading?: boolean
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    fullWidth?: boolean
    animation?: 'none' | 'scale' | 'bounce' | 'pulse' | 'slide'
    enableAudio?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({
         className,
         variant = 'default',
         size = 'md',
         loading = false,
         leftIcon,
         rightIcon,
         fullWidth = false,
         animation = 'scale',
         enableAudio = true,
         children,
         disabled,
         onClick,
         onMouseEnter,
         ...props
     }, ref) => {
        const baseClasses = 'relative inline-flex items-center justify-center font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none select-none overflow-hidden'

        const variantClasses = {
            default: 'bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-deep))] shadow-rest',
            primary: 'bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-deep))] shadow-rest',
            secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
            outline: 'border border-input bg-transparent text-foreground hover:bg-muted hover:border-primary/40',
            ghost: 'text-foreground hover:bg-muted',
            destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 shadow-rest',
            success: 'bg-[hsl(142_70%_39%)] text-white hover:opacity-90 shadow-rest',
            warning: 'bg-[hsl(38_85%_40%)] text-white hover:opacity-90 shadow-rest',
        }

        const sizeClasses = {
            xs: 'h-7 px-2 text-xs rounded-md',
            sm: 'h-8 px-3 text-sm rounded-md',
            md: 'h-9 px-4 text-sm rounded-lg',
            lg: 'h-11 px-6 text-base rounded-[10px]',
            xl: 'h-12 px-8 text-lg rounded-xl',
            icon: 'h-9 w-9 rounded-lg',
        }

        const iconSizeClasses = {
            xs: 'w-3 h-3',
            sm: 'w-3.5 h-3.5',
            md: 'w-4 h-4',
            lg: 'w-5 h-5',
            xl: 'w-6 h-6',
            icon: 'w-4 h-4',
        }

        const animationVariants = {
            none: {},
            scale: {
                hover: {scale: 1.02},
                tap: {scale: 0.98}
            },
            bounce: {
                hover: {
                    scale: 1.03,
                    transition: {type: "spring", stiffness: 400, damping: 10}
                },
                tap: {scale: 0.97}
            },
            pulse: {
                hover: {
                    scale: 1.02,
                    boxShadow: "0 0 0 6px rgba(78, 205, 196, 0.16)"
                },
                tap: {scale: 0.98}
            },
            slide: {
                hover: {
                    x: 2,
                    scale: 1.01
                },
                tap: {x: 0, scale: 0.99}
            }
        }

        const iconSize = iconSizeClasses[size]
        
        const isVertical = className?.includes('flex-col')

        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            if (enableAudio && !disabled && !loading) {
                playClickSound()
            }
            onClick?.(e)
        }

        const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
            if (enableAudio && !disabled && !loading) {
                playHoverSound()
            }
            onMouseEnter?.(e)
        }

        return (
            <motion.button
                ref={ref}
                className={cn(
                    isVertical ? 'relative flex' : baseClasses,
                    isVertical ? 'flex-col items-center' : '',
                    variantClasses[variant],
                    sizeClasses[size],
                    fullWidth && 'w-full',
                    className
                )}
                disabled={disabled || loading}
                variants={animationVariants[animation]}
                whileHover={disabled || loading || animation === 'none' ? {} : (animationVariants[animation] as any).hover}
                whileTap={disabled || loading || animation === 'none' ? {} : (animationVariants[animation] as any).tap}
                transition={{duration: 0.15, ease: "easeOut"}}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                {...(props as any)}
            >
                {(leftIcon || rightIcon) && !isVertical ? (
                    <div className={cn('relative flex items-center justify-center gap-2 whitespace-nowrap')}>
                        {loading && (
                            <motion.div
                                animate={{rotate: 360}}
                                transition={{duration: 1, repeat: Infinity, ease: 'linear'}}
                                className={cn('border-2 border-current border-t-transparent rounded-full flex-shrink-0', iconSize)}
                            />
                        )}
                        {!loading && leftIcon && (
                            <span className={cn('flex-shrink-0 inline-flex items-center', iconSize)}>
                                {leftIcon}
                            </span>
                        )}
                        {children && (
                            <span className="truncate inline-block">
                                {children}
                            </span>
                        )}
                        {!loading && rightIcon && (
                            <span className={cn('flex-shrink-0 inline-flex items-center', iconSize)}>
                                {rightIcon}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className={cn('relative', isVertical ? 'flex flex-col items-center gap-1' : 'flex items-center gap-2')}>
                        {loading && (
                            <motion.div
                                animate={{rotate: 360}}
                                transition={{duration: 1, repeat: Infinity, ease: 'linear'}}
                                className={cn('border-2 border-current border-t-transparent rounded-full flex-shrink-0', iconSize)}
                            />
                        )}
                        {!loading && leftIcon && (
                            <span className={cn('flex-shrink-0 inline-flex items-center', iconSize)}>
                                {leftIcon}
                            </span>
                        )}
                        {children}
                        {!loading && rightIcon && (
                            <span className={cn('flex-shrink-0 inline-flex items-center', iconSize)}>
                                {rightIcon}
                            </span>
                        )}
                    </div>
                )}
            </motion.button>
        )
    }
)

Button.displayName = 'Button'

export default Button
