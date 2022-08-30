import { useSpring, useTransform, MotionTransform, MotionValue } from 'framer-motion'
import { SpringOptions } from 'popmotion'

export type SingleTransformer<I, O> = (input: I) => O

export const useSmoothTransform = (
    value: MotionValue<unknown>,
    springOptions: SpringOptions,
    transformer: SingleTransformer<unknown, any>
) => useSpring(useTransform(value, transformer), springOptions)
