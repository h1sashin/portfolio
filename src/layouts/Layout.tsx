import { BackgroundGradient, Navbar } from 'components'
import { useRouter } from 'next/router'
import React from 'react'

export const Layout: React.FCC = ({ children }) => {
    const router = useRouter()
    return (
        <div>
            {router.pathname === '/' && <BackgroundGradient />}
            <Navbar />
            {children}
        </div>
    )
}
