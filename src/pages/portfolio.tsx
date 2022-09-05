import { motion } from 'framer-motion'
import { GetStaticProps, NextPage } from 'next'
import Image from 'next/image'
import React from 'react'

const Portfolio: NextPage = () => {
    return (
        <div className="w-screen h-screen flex justify-between items-center">
            <motion.div layoutId="portfolio-section" className="w-screen h-screen shrink-0 bg-secondary relative">
                <motion.figure className="w-full h-full overflow-hidden">
                    <Image
                        src="https://source.unsplash.com/random/1600x900"
                        layout="fill"
                        objectPosition="center"
                        objectFit="cover"
                    />
                </motion.figure>
            </motion.div>
        </div>
    )
}

export default Portfolio

export const getStaticProps: GetStaticProps = async (ctx) => {
    return {
        props: {}
    }
}
