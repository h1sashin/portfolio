import React from 'react'
import { SectionTitleProps } from './types'

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, subtitle }) => {
    return (
        <div className="flex flex-col gap-4">
            <h1 className="font-bold text-4xl text-primary">{title}</h1>
            <p className="font-semibold text-2xl text-disabled">{subtitle}</p>
        </div>
    )
}
