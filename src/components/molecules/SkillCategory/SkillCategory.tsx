import { SectionTitle, Skill } from 'components'
import React from 'react'
import { SkillCategoryProps } from './types'

export const SkillCategory: React.FC<SkillCategoryProps> = ({ id, name, skillsList }) => (
    <div className="w-full flex flex-col gap-16">
        <h3 className="font-semibold text-2xl text-disabled">{name}</h3>
        <div className="w-full grid grid-cols-auto gap-16 md:gap-24 justify-items-center">
            {skillsList.map((skill) => (
                <Skill key={skill.id} {...skill} />
            ))}
        </div>
    </div>
)
