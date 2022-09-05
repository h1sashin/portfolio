import Image from 'next/image'
import React, { useEffect } from 'react'
import { imageAnimation, portfolioExit } from './animation'
import { motion } from 'framer-motion'
import { SectionImageProps } from './types'

export const SectionImage: React.FC<SectionImageProps> = ({ name }) => {
    useEffect(() => {
        console.log('mounted')
    }, [])
    return (
        <motion.div
            id={name}
            layoutId="section-image"
            {...(name === 'portfolio' && portfolioExit)}
            className="w-[50vw] h-[75vh] bg-secondary relative"
        >
            <motion.div {...imageAnimation} className="w-full h-full overflow-hidden">
                <Image className="block" src="https://source.unsplash.com/random/1600x900" layout="fill" />
            </motion.div>
        </motion.div>
    )
}
