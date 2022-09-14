import { AnimatePresence, motion } from 'framer-motion'
import { Loader } from 'components'
import { ButtonProps } from './types'
import { forwardRef } from 'react'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ children, fullWidth, loading, ...props }, ref) => (
    <motion.button
        ref={ref}
        className={`${
            fullWidth ? 'w-full' : 'w-max'
        } relative rounded-lg flex shrink-0 gap-4 items-center bg-primary px-8 py-6 xl:px-5 xl:py-4 text-4xl xl:text-2xl font-bold text-white leading-none`}
        {...props}
    >
        {children}
        <AnimatePresence initial={false}>
            {loading && (
                <motion.span
                    className="w-full h-full absolute left-0 top-0 backdrop-blur-lg flex items-center justify-center bg-primary bg-opacity-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <Loader />
                </motion.span>
            )}
        </AnimatePresence>
    </motion.button>
))
