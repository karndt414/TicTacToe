import React, { useState, useRef } from 'react'

interface NeonButtonProps {
  children: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const NeonButton: React.FC<NeonButtonProps> = (props: NeonButtonProps) => {
  const {
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    type = 'button'
  } = props
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
          border: '2px solid #00D4FF',
          hover: 'linear-gradient(135deg, #00FFFF 0%, #00D4FF 100%)',
          glow: '#00D4FF'
        }
      case 'secondary':
        return {
          bg: 'linear-gradient(135deg, #FF006E 0%, #CC0055 100%)',
          border: '2px solid #FF006E',
          hover: 'linear-gradient(135deg, #FF1493 0%, #FF006E 100%)',
          glow: '#FF006E'
        }
      case 'danger':
        return {
          bg: 'linear-gradient(135deg, #FF6B35 0%, #E55A2B 100%)',
          border: '2px solid #FF6B35',
          hover: 'linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)',
          glow: '#FF6B35'
        }
      case 'success':
        return {
          bg: 'linear-gradient(135deg, #00FF88 0%, #00CC6A 100%)',
          border: '2px solid #00FF88',
          hover: 'linear-gradient(135deg, #00FFAA 0%, #00FF88 100%)',
          glow: '#00FF88'
        }
      default:
        return {
          bg: 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
          border: '2px solid #00D4FF',
          hover: 'linear-gradient(135deg, #00FFFF 0%, #00D4FF 100%)',
          glow: '#00D4FF'
        }
    }
  }

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-4 py-2 text-sm'
      case 'md':
        return 'px-6 py-3 text-base'
      case 'lg':
        return 'px-8 py-4 text-lg'
      default:
        return 'px-6 py-3 text-base'
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return
    
    // Create ripple effect
    const button = buttonRef.current
    if (button) {
      const ripple = document.createElement('span')
      const rect = button.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height)
      const x = e.clientX - rect.left - size / 2
      const y = e.clientY - rect.top - size / 2
      
      ripple.style.width = ripple.style.height = size + 'px'
      ripple.style.left = x + 'px'
      ripple.style.top = y + 'px'
      ripple.classList.add('ripple')
      
      button.appendChild(ripple)
      
      setTimeout(() => {
        ripple.remove()
      }, 600)
    }
    
    setIsPressed(true)
    setTimeout(() => setIsPressed(false), 150)
    
    if (onClick) {
      onClick(e)
    }
  }

  const variantStyles = getVariantStyles()
  const sizeStyles = getSizeStyles()

  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      className={`
        btn-base relative font-bold rounded-lg text-white font-orbitron
        ${sizeStyles}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer transform transition-all duration-200'}
        ${isPressed ? 'scale-95' : 'scale-100'}
        ${isHovered ? 'neon-glow-strong' : 'neon-glow'}
        ${className}
      `}
      style={{
        background: disabled 
          ? 'linear-gradient(135deg, #4A5568 0%, #2D3748 100%)'
          : isHovered 
            ? variantStyles.hover 
            : variantStyles.bg,
        border: disabled 
          ? '2px solid #4A5568'
          : variantStyles.border,
        boxShadow: disabled 
          ? 'none'
          : `0 0 20px ${variantStyles.glow}, inset 0 0 20px rgba(255, 255, 255, 0.1)`
      }}
    >
      {children}
      
      {/* Neon glow effect */}
      {!disabled && (
        <div 
          className="absolute inset-0 rounded-lg opacity-30 pointer-events-none"
          style={{
            background: variantStyles.glow,
            filter: `blur(10px)`,
            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.3s ease'
          }}
        />
      )}
    </button>
  )
}

export default NeonButton