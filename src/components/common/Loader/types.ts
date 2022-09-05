import { SVGAttributes } from 'react'

export interface LoaderProps extends SVGAttributes<SVGElement> {
    size?: 'small' | 'medium' | 'large'
}
