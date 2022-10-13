import React from 'react'
import { socials } from 'data/socials'
import Link from 'next/link'

export const Navbar: React.FC = () => {
    return (
        <div className="z-50 h-28 sm:flex hidden w-screen fixed left-0 top-0 items-center justify-between pl-8 pr-14">
            <span className="text-3xl text-white font-light select-none">{`<DS />`}</span>
            <div className="flex items-center gap-8">
                {socials.map((social) => (
                    <Link scroll={false} key={social.name} href={social.url} passHref>
                        <a target="_blank">
                            {React.cloneElement(social.icon, { size: 36, key: social.name, color: 'white' })}
                        </a>
                    </Link>
                ))}
            </div>
        </div>
    )
}
