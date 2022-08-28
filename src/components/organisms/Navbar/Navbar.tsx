import React from 'react'
import { Spiral as Hamburger } from 'hamburger-react'
import { socials } from 'data/socials'
import Link from 'next/link'

export const Navbar: React.FC = () => {
    return (
        <div className="h-28 w-screen fixed left-0 top-0 flex items-center justify-between px-8">
            <span className="text-3xl text-white font-light">{`<DS />`}</span>
            <div className="flex items-center gap-8">
                {socials.map((social) => (
                    <Link href={social.url} passHref>
                        <a>{React.cloneElement(social.icon, { size: 36, key: social.name, color: 'white' })}</a>
                    </Link>
                ))}
                <Hamburger color="#fff" rounded size={40} />
            </div>
        </div>
    )
}
