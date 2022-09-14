import { ContactForm, SectionTitle } from 'components'
import React from 'react'

export const ContactSection: React.FC = () => {
    return (
        <section className="flex gap-8 h-max my-32 flex-col">
            <SectionTitle
                title="Contact me!"
                subtitle="You have any project idea and you want someone to code it for you? Just fill the form!"
            />
            <ContactForm />
        </section>
    )
}
