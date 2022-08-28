import React from 'react'
import { Props } from './types'

export const SectionTitle: React.FC<Props> = ({ subtitle, title, moreUrl }) => {
    return (
        <div className="flex flex-col gap-8 text-white max-w-xs">
            <h1 className="text-9xl">{title}</h1>
            <div className="flex flex-col gap-4">
                <span className="bg-primary w-24 h-2 rounded-xl ml-8" />
                <span className="bg-primary w-24 h-2 rounded-xl ml-24" />
            </div>
            <p className="text-4xl leading-relaxed">{subtitle}</p>
        </div>
    )
}
