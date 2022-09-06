import React from 'react'
import { SectionTitleProps } from './types'

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, subtitle }) => {
    return (
        <div className="flex flex-col gap-4">
            <h1 className="font-bold text-6xl lg:text-4xl text-primary">{title}</h1>
            <p className="font-semibold text-4xl md:text-3xl 2xl:text-2xl text-disabled">{subtitle}</p>
        </div>
    )
}
