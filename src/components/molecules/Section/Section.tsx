import React, { HTMLAttributes, WithChildren } from 'react'

export const Section: React.FC<WithChildren<HTMLAttributes<HTMLDivElement>>> = ({ children, ...props }) => {
    return (
        <section {...props} className="section w-screen h-screen p-72">
            {children}
        </section>
    )
}
