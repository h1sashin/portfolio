import React from 'react'
import { TextareaProps } from './types'

export const Textarea: React.FC<TextareaProps> = ({ label, error, ...props }) => {
    return (
        <div className="relative bg-secondary flex mb-5 items-end pt-2.5">
            <textarea
                id={props.name}
                className={`text-white transition-colors peer px-5 bg-transparent text-2xl pt-5 w-full outline-none border-b ${
                    !!error ? 'border-b-error' : 'focus:border-b-primary border-b-transparent'
                }`}
                placeholder=" "
                {...props}
            />
            <label
                htmlFor={props.name}
                className={`absolute top-1.5 left-5 ${
                    !!error ? 'text-error' : 'text-white peer-focus:text-primary'
                } transform transition-colors`}
            >
                {label}
            </label>
            {!!error && <span className="absolute top-full left-5 text-error text-sm">{error}</span>}
        </div>
    )
}
