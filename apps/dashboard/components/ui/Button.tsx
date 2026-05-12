import React from 'react';
import Link from 'next/link';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    href?: string; // Add href support
}

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    href,
    ...props
}: ButtonProps) {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-4 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed";

    const variants = {
        primary: "text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5",
        secondary: "text-gray-900 bg-white hover:bg-gray-50 focus:ring-gray-100 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm",
        outline: "text-blue-600 bg-transparent border border-blue-600 hover:bg-blue-50 focus:ring-blue-300 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-gray-800"
    };

    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-5 py-2.5 text-sm",
        lg: "px-6 py-3.5 text-base"
    };

    const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

    if (href) {
        return (
            <Link href={href} className={classes}>
                {children}
            </Link>
        );
    }

    return (
        <button
            className={classes}
            {...props}
        >
            {children}
        </button>
    );
}
