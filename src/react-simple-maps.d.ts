declare module 'react-simple-maps' {
  import { ReactNode, CSSProperties, MouseEvent } from 'react'

  export interface ComposableMapProps {
    projection?: string
    projectionConfig?: Record<string, unknown>
    width?: number
    height?: number
    style?: CSSProperties
    children?: ReactNode
  }
  export function ComposableMap(props: ComposableMapProps): JSX.Element

  export interface ZoomableGroupProps {
    zoom?: number
    center?: [number, number]
    children?: ReactNode
  }
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element

  export interface GeographiesProps {
    geography: string | object
    children: (args: { geographies: Geography[] }) => ReactNode
  }
  export function Geographies(props: GeographiesProps): JSX.Element

  export interface Geography {
    rsmKey: string
    properties: Record<string, unknown>
    geometry: object
  }

  export interface GeographyStyle {
    fill?: string
    stroke?: string
    strokeWidth?: number
    outline?: string
    cursor?: string
    transition?: string
  }

  export interface GeographyProps {
    geography: Geography
    style?: {
      default?: GeographyStyle
      hover?: GeographyStyle
      pressed?: GeographyStyle
    }
    onClick?: (event: MouseEvent<SVGPathElement>) => void
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void
  }
  export function Geography(props: GeographyProps): JSX.Element
}
