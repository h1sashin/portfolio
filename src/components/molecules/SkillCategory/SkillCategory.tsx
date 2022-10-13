import { Skill } from 'components'
import React from 'react'
import { SkillCategoryProps } from './types'

export const SkillCategory: React.FC<SkillCategoryProps> = ({ name, skillsList }) => (
    <div className="w-full flex flex-col gap-16">
        <header className="font-semibold text-2xl text-disabled">{name}</header>
        <div className="w-full grid grid-cols-auto gap-16 md:gap-24 justify-items-center">
            {skillsList.map((skill) => (
                <Skill key={skill.id} {...skill} />
            ))}
        </div>
    </div>
)
