import Image from 'next/image'
import React from 'react'
import { imageAnimation, wrapperAnimation } from './animation'
import { motion } from 'framer-motion'

export const SectionImage: React.FC = () => {
    return (
        <motion.div {...wrapperAnimation} className="w-[50vw] h-[75vh] bg-secondary relative">
            <motion.div {...imageAnimation} className="w-full h-full overflow-hidden">
                <Image src="https://source.unsplash.com/random/1600x900" layout="fill" />
            </motion.div>
        </motion.div>
    )
}
