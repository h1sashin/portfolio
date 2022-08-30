import React from 'react'
import { SectionImage, SectionTitle } from 'components'

export const PortfolioSection: React.FC = () => {
    return (
        <div className="w-full h-full flex items-center justify-between">
            <SectionTitle title="Portfolio" subtitle="Projects I made" moreUrl="/portfolio" />
            <SectionImage />
        </div>
    )
}
