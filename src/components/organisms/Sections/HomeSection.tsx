import { SectionTitle } from 'components'
import { HeroAnimation } from 'components/atoms/HeroAnimation'
import React from 'react'

export const HomeSection: React.FC = () => {
    return (
        <div className="w-full h-full flex items-center justify-between">
            <SectionTitle title="Dawid Szemborowski" subtitle="Frontend Developer / React Engineer" />
            <HeroAnimation />
        </div>
    )
}
