import { Navbar } from 'components'
import { motion } from 'framer-motion'
import React, { WithChildren } from 'react'

export const Layout: React.FC<WithChildren> = ({ children }) => {
    return (
        <motion.div layoutScroll className="px-64 flex flex-col">
            <Navbar />
            {children}
        </motion.div>
    )
}
