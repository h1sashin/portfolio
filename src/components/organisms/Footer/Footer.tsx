import { sections } from 'data/sections'
import { socials } from 'data/socials'
import Link from 'next/link'
import React from 'react'

export const Footer: React.FC = () => {
    return (
        <div className="absolute left-0 w-screen h-80 border-t-2 border-t-primary flex items-center justify-center flex-col gap-8">
            <div className="flex gap-8">
                {socials.map((social) => (
                    <Link scroll={false} key={social.name} href={social.url} passHref>
                        <a target="_blank">
                            {React.cloneElement(social.icon, { size: 36, key: social.name, color: 'white' })}
                        </a>
                    </Link>
                ))}
            </div>
            <div className="gap-6 flex flex-wrap justify-center items-center">
                {sections.map((section) => (
                    <Link href={`#${section}`} passHref>
                        <a className="capitalize font-medium text-lg text-white">{section.replace('-', ' ')}</a>
                    </Link>
                ))}
            </div>
            <span className="text-white font-medium">Dawid Szemborowski</span>
        </div>
    )
}
