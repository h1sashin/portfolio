import { Navbar } from 'components'
import { motion } from 'framer-motion'
import React, { WithChildren } from 'react'

export const Layout: React.FC<WithChildren> = ({ children }) => {
    return (
        <motion.div layoutScroll className="px-16 lg:px-64">
            <Navbar />
            {children}
        </motion.div>
    )
}
