import React from 'react'
import { SkillProps } from './types'

export const Skill: React.FC<SkillProps> = ({ name, icon }) => (
    <div className="flex flex-col gap-4 justify-center items-center w-max h-max">
        <img alt={`${name} logo`} className="h-24 aspect-square" src={icon?.url} height="inherit" width="inherit" />
        <span className="text-lg text-white font-semibold">{name}</span>
    </div>
)
