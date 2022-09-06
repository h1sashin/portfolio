import { SectionTitle } from 'components/atoms'
import { Project } from 'components/molecules/Project'
import React from 'react'
import { PortfolioProps } from './types'

export const PortfolioSection: React.FC<PortfolioProps> = ({ portfolio }) => {
    return (
        <section className="min-h-screen flex flex-col gap-8 py-32">
            <SectionTitle title="Portfolio" subtitle="There is some projects I have worked on" />
            <div className="grid 2xl:grid-cols-3 grid-cols-1 md:grid-cols-2 h-screen gap-8">
                {portfolio.map((project) => (
                    <Project key={project.id} project={project} />
                ))}
            </div>
        </section>
    )
}
