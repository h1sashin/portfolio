import { MeCard } from 'components/atoms/MeCard'
import React from 'react'
import { AboutMeProps } from './types'

export const AboutMeSection: React.FC<AboutMeProps> = ({ aboutMe, skills }) => {
    console.log(aboutMe)
    return (
        <section className="min-h-screen flex items-center justify-between">
            <div className="flex justify-between gap-8">
                <div className="w-[32rem] shrink-0">
                    <MeCard image={aboutMe.photo?.url} description={aboutMe.description} />
                </div>
                <div className="w-full"></div>
            </div>
        </section>
    )
}
