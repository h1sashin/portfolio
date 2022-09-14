import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { ProjectProps } from './types'
import { motion } from 'framer-motion'
import { BrandGithub, ExternalLink } from 'tabler-icons-react'

export const Project: React.FC<ProjectProps> = ({ project }) => {
    return (
        <div className="w-full flex flex-col gap-4 relative">
            <div className="relative overflow-hidden rounded-xl w-full aspect-video shadow-xl shadow-[#000000A0]">
                <Image
                    src={project.image[0].url}
                    alt={project.name}
                    layout="fill"
                    objectFit="cover"
                    objectPosition="center"
                />
                <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="absolute left-0 bottom-0 h-full w-full flex-col bg-black bg-opacity-90 p-4 flex justify-between items-end"
                >
                    <h2 className="self-start p-0 text-2xl text-white">{project.description}</h2>
                    <div className="flex gap-4 text-white">
                        {project.demo && (
                            <Link href={project.demo} passHref>
                                <a>
                                    <ExternalLink size={'3rem'} />
                                </a>
                            </Link>
                        )}
                        {project.sourceCode && (
                            <Link href={project.sourceCode} passHref>
                                <a>
                                    <BrandGithub size={'4rem'} />
                                </a>
                            </Link>
                        )}
                    </div>
                </motion.div>
            </div>
            <div className="bg-black bg-opacity-95 w-full h-max py-3 px-4">
                <h2 className="text-white text-2xl">{project.name}</h2>
                <p className="text-disabled text-xl">{project.stack.map((tech) => `#${tech}`).join(', ')}</p>
            </div>
        </div>
    )
}
