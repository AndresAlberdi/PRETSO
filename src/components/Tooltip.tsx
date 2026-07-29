import type { ReactNode } from 'react';

export default function Tooltip({ content, children }: { content: string, children?: ReactNode }) {
  return (
    <span title={content} style={{ cursor: 'help', marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center' }}>
      {children || (
        <span style={{ 
          background: 'rgba(255,255,255,0.2)', 
          borderRadius: '50%', 
          width: '18px', height: '18px', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          fontSize: '12px', fontWeight: 'bold' 
        }}>
          ?
        </span>
      )}
    </span>
  );
}
