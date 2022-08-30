import { Input, Textarea } from 'components'
import { useFormik } from 'formik'
import React from 'react'
import { ContactFormValues } from './types'
import { validation } from './validation'

export const ContactForm = () => {
    const handleSubmit = ({ email, message, name }: ContactFormValues) => {
        console.log(email, message, name)
    }

    const formik = useFormik<ContactFormValues>({
        initialValues: {
            name: '',
            email: '',
            message: ''
        },
        validationSchema: validation,
        onSubmit: handleSubmit
    })

    return (
        <form onSubmit={formik.handleSubmit} className="flex flex-col gap-4 w-full max-w-4xl h-full max-h-96 scale-125">
            <Input label="Name" name="name" value={formik.values.name} onChange={formik.handleChange} />
            <Input label="Email" name="email" value={formik.values.email} onChange={formik.handleChange} />
            <Textarea
                rows={5}
                cols={1}
                label="Message"
                name="message"
                value={formik.values.message}
                onChange={formik.handleChange}
            />
        </form>
    )
}
