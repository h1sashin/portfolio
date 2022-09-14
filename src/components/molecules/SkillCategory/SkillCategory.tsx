import { SectionTitle, Skill } from 'components'
import React from 'react'
import { SkillCategoryProps } from './types'

export const SkillCategory: React.FC<SkillCategoryProps> = ({ id, name, skillsList }) => (
    <div className="w-full flex flex-col gap-4">
        <h3 className="font-semibold text-4xl md:text-3xl 2xl:text-2xl text-disabled">{name}</h3>
        <div className="w-full flex gap-24 flex-wrap">
            {skillsList.map((skill) => (
                <Skill {...skill} />
            ))}
        </div>
    </div>
)
