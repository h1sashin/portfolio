import { MotionProps } from 'framer-motion'

export const animation: MotionProps = {
    initial: {
        translateX: '-100%'
    },
    whileInView: {
        translateX: 0
    },
    transition: {
        duration: 0.75,
        ease: 'easeInOut'
    }
}
