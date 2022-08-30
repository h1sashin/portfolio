import React from 'react'
import { SectionImage, SectionTitle } from 'components/atoms'

export const AboutMeSection: React.FC = () => {
    return (
        <div className="w-full h-full flex items-center justify-between">
            <SectionTitle title="About Me" subtitle="I'm in love with new technologies" moreUrl="/about-me" />
            <SectionImage />
        </div>
    )
}
