import React from 'react'
import { motion } from 'framer-motion'
import { circleAnimation } from './animation'
import { CircleProps } from './types'

export const Circle: React.FC<CircleProps> = ({ highlight }) => {
    return <motion.div {...circleAnimation(highlight)} className=" w-16 h-16" />
}
