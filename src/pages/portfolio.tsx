import { motion } from 'framer-motion'
import { GetStaticProps, NextPage } from 'next'
import Image from 'next/image'
import React from 'react'

const Portfolio: NextPage = () => {
    return (
        <div className="w-screen h-screen flex justify-between items-center">
            <motion.div className="p-32 text-4xl text-white">Test</motion.div>
            <motion.div layoutId="section-image" className="w-[50vw] h-screen bg-secondary relative">
                <motion.div className="w-full h-full overflow-hidden">
                    <Image className="block" src="https://source.unsplash.com/random/1600x900" layout="fill" />
                </motion.div>
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
