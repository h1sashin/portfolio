import { SectionTitle, ContactForm } from 'components'
import React from 'react'

export const ContactSection: React.FC = () => {
    return (
        <div className="w-full h-full flex items-center justify-between">
            <SectionTitle title="Get in touch!" subtitle="hiszaszin@gmail.com" />
            <ContactForm />
        </div>
    )
}
