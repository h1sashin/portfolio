import { MotionProps } from 'framer-motion'

export const imageAnimation: MotionProps = {
    initial: {
        clipPath: 'circle(0% at 50% 100%)'
    },
    whileInView: {
        clipPath: ['circle(0% at 50% 100%)', 'circle(25% at 50% 50%)', 'circle(100% at 50% 50%)']
    },
    transition: {
        duration: 0.75
    }
}

export const wrapperAnimation: MotionProps = {
    initial: {
        scale: 0.8
    },
    whileInView: {
        scale: 1
    },
    transition: {
        duration: 0.75
    }
}
