import React from 'react'
import { TextareaProps } from './types'

export const Textarea: React.FC<TextareaProps> = ({ label, ...props }) => {
    return (
        <div className="relative bg-secondary flex items-end pt-6">
            <textarea
                id={props.name}
                className="resize-none text-white transition-colors peer px-4 bg-transparent text-xl w-full outline-none border-b focus:border-b-primary border-b-primary placeholder-shown:border-b-transparent"
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
