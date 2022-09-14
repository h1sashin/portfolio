import { SectionTitle, Project } from 'components'
import React from 'react'
import { PortfolioProps } from './types'

export const PortfolioSection: React.FC<PortfolioProps> = ({ portfolio }) => {
    return (
        <section className="flex flex-col gap-8 py-32">
            <SectionTitle title="Portfolio" subtitle="There is some projects I have worked on" />
            <div className="grid 2xl:grid-cols-3 grid-cols-1 md:grid-cols-2 gap-8">
                {portfolio.map((project) => (
                    <Project key={project.id} project={project} />
                ))}
            </div>
        </section>
    )
}
