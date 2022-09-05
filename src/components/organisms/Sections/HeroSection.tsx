import { Button } from 'components'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { BrandGithub, BrandGmail, BrandLinkedin } from 'tabler-icons-react'

export const HeroSection: React.FC = () => {
    return (
        <div className="h-screen w-screen flex items-center justify-center">
            <div className="w-full flex flex-col relative h-max gap-16">
                <div className="flex flex-col">
                    <div className="absolute -left-4 -top-6 -z-10">
                        <Image src="https://svgsilh.com/svg/26432.svg" height="128" width="128" />
                    </div>
                    <p className="text-6xl text-primary">Hey there!, I'm</p>
                    <h1 className="text-[10rem] font-bold text-white">Dawid Szemborowski.</h1>
                </div>
                <p className="text-disabled text-4xl w-1/2 leading-tight">
                    <span className="text-4xl font-bold text-primary mr-4">React Developer / Software Engineer, </span>A
                    Self-taught developer with a passion to IT
                </p>
                <div className="flex flex-col gap-4">
                    <p className="text-disabled text-4xl leading-tight">🚀 Learning new technologies everyday</p>
                    <p className="text-disabled text-4xl leading-tight">
                        💻 Currently providing my services at{' '}
                        <Link href="https://aexol.com/" passHref>
                            <a target="_blank" className="text-primary text-4xl">
                                AEXOL
                            </a>
                        </Link>
                    </p>
                </div>
                <div className="flex gap-8">
                    <Button>
                        <BrandLinkedin />
                        LinkedIn
                    </Button>
                    <Button>
                        <BrandGithub />
                        GitHub
                    </Button>
                    <Button>
                        <BrandGmail />
                        Email
                    </Button>
                </div>
            </div>
        </div>
    )
}
