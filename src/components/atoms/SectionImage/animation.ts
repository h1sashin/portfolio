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
    },
    viewport: { once: true }
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
    },
    viewport: { once: true }
}

export const portfolioExit: MotionProps = {
    exit: {
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100vh'
    }
}
