import { object, string } from 'yup'

export const validation = object({
    name: string().required('Please provide your name'),
    email: string().email('Please provide a valid email').required('Please provide your email'),
    message: string().required('Please provide a message')
})
