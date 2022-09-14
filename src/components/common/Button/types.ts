import { MotionProps } from 'framer-motion'
import { ButtonHTMLAttributes } from 'react'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
    MotionProps & { fullWidth?: boolean; loading?: boolean }
