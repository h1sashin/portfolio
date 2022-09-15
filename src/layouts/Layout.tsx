import { Footer, Navbar } from 'components'
import { motion } from 'framer-motion'
import React, { WithChildren } from 'react'

export const Layout: React.FC<WithChildren> = ({ children }) => {
    return (
        <motion.div layoutScroll className="px-4 sm:px-16 xl:px-64 pb-80">
            <Navbar />
            {children}
            <Footer />
        </motion.div>
    )
}
