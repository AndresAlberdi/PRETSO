import { useState } from 'react';

export default function Tooltip({ content, children }: { content: string, children?: React.ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '0.5rem', cursor: 'help' }} 
         onMouseEnter={() => setShow(true)} 
         onMouseLeave={() => setShow(false)}>
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
      {show && (
        <div style={{
          position: 'absolute',
          bottom: '120%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#333',
          color: '#fff',
          padding: '0.5rem',
          borderRadius: '4px',
          fontSize: '0.85rem',
          whiteSpace: 'nowrap',
          zIndex: 100,
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          pointerEvents: 'none'
        }}>
          {content}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: '5px',
            borderStyle: 'solid',
            borderColor: '#333 transparent transparent transparent'
          }}></div>
        </div>
      )}
    </div>
  );
}
