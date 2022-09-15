import { Input, Textarea, Button } from 'components'
import { useFormik } from 'formik'
import React from 'react'
import { ContactFormValues } from './types'
import { validation } from './validation'

export const ContactForm = () => {
    const handleSubmit = async ({ email, message, name }: ContactFormValues) => {
        formik.setSubmitting(true)
        window.dataLayer.push({
            event: 'contactFormSubmit'
        })
        const data = {
            service_id: process.env.NEXT_PUBLIC_SERVICE_ID,
            template_id: process.env.NEXT_PUBLIC_TEMPLATE_ID,
            user_id: process.env.NEXT_PUBLIC_USER_ID,
            template_params: {
                email,
                message,
                name
            }
        }
        try {
            await fetch('https://api.emailj.com/api/v1.0/email/send', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            alert('Message sent successfully')
        } catch {
            alert('Unfortunately, message was not sent, an error occured')
        }
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
        <form onSubmit={formik.handleSubmit} className="flex flex-col gap-4 w-full max-w-5xl">
            <Input
                label="Name"
                name="name"
                value={formik.values.name}
                onChange={formik.handleChange}
                error={formik.errors.name}
            />
            <Input
                label="Email"
                name="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                error={formik.errors.email}
            />
            <Textarea
                rows={5}
                cols={1}
                label="Message"
                name="message"
                value={formik.values.message}
                onChange={formik.handleChange}
                error={formik.errors.message}
            />
            <Button type="submit" loading={formik.isSubmitting}>
                Contact me!
            </Button>
        </form>
    )
}
