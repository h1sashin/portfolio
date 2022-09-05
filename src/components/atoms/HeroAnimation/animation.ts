import { MotionProps } from 'framer-motion'

export const circleAnimation = (highlight?: boolean): MotionProps => ({
    variants: {
        highlighted: {
            backgroundColor: '#E8476A'
        },
        unhighlighted: {
            backgroundColor: '#061526'
        }
    },
    whileInView: highlight ? 'highlighted' : 'unhighlighted',
    transition: {
        duration: 0.75
    }
})
