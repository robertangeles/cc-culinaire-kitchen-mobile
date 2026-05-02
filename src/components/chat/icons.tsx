import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { palette } from '@/constants/theme';

import type { IconProps } from './icons-types';

const baseProps = {
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function MicIcon({ size = 24, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x={9}
        y={2}
        width={6}
        height={13}
        rx={3}
        stroke={color}
        strokeWidth={2}
        {...baseProps}
      />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" stroke={color} strokeWidth={2} {...baseProps} />
    </Svg>
  );
}

export function SendIcon({ size = 24, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 19V5M5 12l7-7 7 7" stroke={color} strokeWidth={2.2} {...baseProps} />
    </Svg>
  );
}

export function MoreIcon({ size = 24, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={5} r={1.6} fill={color} />
      <Circle cx={12} cy={12} r={1.6} fill={color} />
      <Circle cx={12} cy={19} r={1.6} fill={color} />
    </Svg>
  );
}

export function HistoryIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 12a9 9 0 1 0 3-6.7L3 8" stroke={color} strokeWidth={1.85} {...baseProps} />
      <Path d="M3 3v5h5M12 7v5l3 2" stroke={color} strokeWidth={1.85} {...baseProps} />
    </Svg>
  );
}

export function NewChatIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6"
        stroke={color}
        strokeWidth={1.85}
        {...baseProps}
      />
      <Path
        d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"
        stroke={color}
        strokeWidth={1.85}
        {...baseProps}
      />
    </Svg>
  );
}

export function TrashIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
        stroke={color}
        strokeWidth={1.85}
        {...baseProps}
      />
    </Svg>
  );
}

export function GlobeIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.85} {...baseProps} />
      <Path
        d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
        stroke={color}
        strokeWidth={1.85}
        {...baseProps}
      />
    </Svg>
  );
}

export function SettingsGearIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.85} {...baseProps} />
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8L4.2 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        stroke={color}
        strokeWidth={1.85}
        {...baseProps}
      />
    </Svg>
  );
}

export function SignOutIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
        stroke={color}
        strokeWidth={1.85}
        {...baseProps}
      />
    </Svg>
  );
}

export function DownloadIcon({ size = 16, color = palette.copperDeep }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3v12M6 11l6 6 6-6M5 21h14" stroke={color} strokeWidth={2.2} {...baseProps} />
    </Svg>
  );
}
