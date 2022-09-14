import { SectionTitle, SkillCategory } from 'components'
import React from 'react'
import { AboutMeProps } from './types'

export const AboutMeSection: React.FC<AboutMeProps> = ({ aboutMe, skills }) => (
    <section className="flex flex-col gap-8">
        <SectionTitle title="Skills" />
        <div className="flex flex-col gap-8">
            {skills.map((skill) => (
                <SkillCategory key={skill.id} {...skill} />
            ))}
        </div>
    </section>
)
