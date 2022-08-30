import { Button } from 'components'
import Link from 'next/link'
import React from 'react'
import { SectionTitleProps } from './types'
import { motion } from 'framer-motion'
import { animation } from './animation'

export const SectionTitle: React.FC<SectionTitleProps> = ({ subtitle, title, moreUrl }) => {
    return (
        <div className="flex flex-col gap-8 text-white whitespace-nowrap overflow-hidden">
            <motion.h1 {...animation} className="text-9xl font-bold">
                {title}
            </motion.h1>
            <motion.div {...animation} className="flex flex-col gap-4">
                <motion.span {...animation} className="bg-primary w-24 h-2 rounded-xl" />
                <motion.span {...animation} className="bg-primary w-24 h-2 rounded-xl ml-16" />
            </motion.div>
            <motion.p {...animation} className="text-4xl leading-relaxed">
                {subtitle}
            </motion.p>
            {moreUrl && (
                <motion.div {...animation}>
                    <Link href={moreUrl} passHref>
                        <Button>Know more!</Button>
                    </Link>
                </motion.div>
            )}
        </div>
    )
}
