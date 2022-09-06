import Image from 'next/image'
import React from 'react'
import { MeCardProps } from './types'

export const MeCard: React.FC<MeCardProps> = ({ description, image }) => {
    return (
        <div className="w-full rounded-xl bg-black shadow-xl gap-8 flex flex-col shadow-[#000000A0] p-8">
            <div className="flex  items-center gap-8">
                <div className="rounded-full h-24 w-24 border-2 border-secondary bg-disabled">
                    <Image src={image || ''} layout="fill" objectFit="cover" objectPosition="center" />
                </div>
                <h2 className="text-2xl text-white">Dawid Szemborowski</h2>
            </div>
            <p className="text-xl text-disabled text-justify">{description}</p>
        </div>
    )
}
