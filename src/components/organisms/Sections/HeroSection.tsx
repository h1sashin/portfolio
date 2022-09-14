import { Button } from 'components'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { HeroProps } from './types'

export const HeroSection: React.FC<HeroProps> = ({ company, links }) => {
    return (
        <section id="hero" className="min-h-screen w-full flex relative items-center justify-center">
            <div className="absolute right-16 top-3/4">
                <Image src="https://svgsilh.com/svg/26432.svg" height="256" width="256" />
            </div>
            <div className="w-full flex flex-col relative h-max gap-6 sm:gap-16">
                <div className="flex flex-col">
                    <div className="absolute -left-4  -top-6 -z-10">
                        <Image src="https://svgsilh.com/svg/26432.svg" height="128" width="128" />
                    </div>
                    <p className="text-2xl sm:text-3xl xl:text-5xl text-primary">Hey there!, I'm</p>
                    <h1 className="text-4xl sm:text-6xl xl:text-8xl font-bold text-white leading-normal">
                        Dawid Szemborowski.
                    </h1>
                </div>
                <p className="text-disabled text-xl sm:text-2xl xl:text-4xl lg:w-1/2 leading-normal">
                    <span className="text-xl sm:text-2xl xl:text-4xl font-bold text-primary mr-4 leading-normal">
                        React Developer / Software Engineer,{' '}
                    </span>
                    A Self-taught developer with a passion to IT
                </p>
                <div className="flex flex-col gap-4">
                    <p className="text-disabled text-xl sm:text-2xl xl:text-3xl leading-tight">
                        🚀 Learning new technologies everyday
                    </p>
                    {company && (
                        <p className="text-disabled text-xl sm:text-2xl xl:text-3xl leading-tight">
                            💻 Currently providing my services at{' '}
                            <Link href={company.companyWebsite || '#'} passHref>
                                <a
                                    target="_blank"
                                    className="text-primary text-xl sm:text-2xl xl:text-4xl hover:underline"
                                >
                                    {company.companyName}
                                </a>
                            </Link>
                        </p>
                    )}
                </div>
                <div className="flex gap-8 flex-wrap">
                    {links.map(({ name, url }) => (
                        <Link key={name} href={url}>
                            <Button>{name}</Button>
                        </Link>
                    ))}
                    <Link href="mailto:">
                        <Button>Contact me</Button>
                    </Link>
                </div>
            </div>
        </section>
    )
}
