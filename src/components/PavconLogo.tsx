interface Props {
  size?: number
  className?: string
}

export default function PavconLogo({ size = 40, className = '' }: Props) {
  return (
    <img
      src="/logo-pavcon.png"
      alt="Pavcon Construtora"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}
