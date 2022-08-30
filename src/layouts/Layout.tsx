import { Navbar } from 'components'
import { useRouter } from 'next/router'
import React, { WithChildren } from 'react'

export const Layout: React.FC<WithChildren> = ({ children }) => {
    return (
        <div>
            <Navbar />
            {children}
        </div>
    )
}
