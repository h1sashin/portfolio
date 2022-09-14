import { SectionTitle, SkillCategory } from 'components'
import React from 'react'
import { AboutMeProps } from './types'

export const AboutMeSection: React.FC<AboutMeProps> = ({ aboutMe, skills }) => (
    <section id="about-me" className="flex flex-col gap-8 pt-32">
        <SectionTitle title="About me" />
        <span className="text-white text-xl font-medium mb-16">{aboutMe.description}</span>
        <SectionTitle title="Skills" />
        <div className="flex flex-col gap-8">
            {skills.map((skill) => (
                <SkillCategory key={skill.id} {...skill} />
            ))}
        </div>
    </section>
)
