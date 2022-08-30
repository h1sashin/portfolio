import React from 'react'
import { InputProps } from './types'

export const Input: React.FC<InputProps> = ({ label, ...props }) => {
    return (
        <div className="relative h-16 bg-secondary flex items-end pt-2">
            <input
                type="text"
                id={props.name}
                className="text-white transition-colors peer px-4 bg-transparent text-xl h-16 pt-4 w-full outline-none border-b focus:border-b-primary border-b-primary placeholder-shown:border-b-transparent"
                placeholder=" "
                {...props}
            />
            <label
                htmlFor={props.name}
                className="absolute top-1 left-4 peer-placeholder-shown:text-white text-sm peer-focus:text-primary transform transition-colors text-primary"
            >
                {label}
            </label>
        </div>
    )
}
