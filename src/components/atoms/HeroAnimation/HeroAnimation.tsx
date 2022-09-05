import { AnimatePresence } from 'framer-motion'
import React, { useEffect, useState } from 'react'
import { Circle } from './Circle'
import { VARIANTS } from './variants'

export const HeroAnimation: React.FC = ({}) => {
    const [table, setTable] = useState<(0 | 1)[][]>([
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0]
    ])
    useEffect(() => {
        const interval = window.setInterval(() => {
            setTable(VARIANTS[Math.floor(Math.random() * VARIANTS.length)])
        }, 1000)
        return () => window.clearInterval(interval)
    }, [])
    return (
        <div className="flex flex-col gap-4">
            <AnimatePresence>
                {table.map((v, i) => (
                    <div key={i} className="flex gap-4 justify-end">
                        {v.map((vi, ix) => (
                            <Circle highlight={!!vi} key={`${i}x${ix}`} />
                        ))}
                    </div>
                ))}
            </AnimatePresence>
        </div>
    )
}
