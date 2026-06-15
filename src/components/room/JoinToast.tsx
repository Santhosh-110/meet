import { useEffect } from 'react'
import { useClassroomStore } from '../../stores/classroomStore'
import { LogIn, LogOut, Hand } from 'lucide-react'

export function JoinToast() {
  const notifications = useClassroomStore(state => state.joinNotifications)
  const dismiss = useClassroomStore(state => state.dismissJoinNotification)

  return (
    <div style={{
      position: 'fixed',
      bottom: '5.5rem', // Floating just above control bar
      left: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      {notifications.map((n) => (
        <ToastItem key={n.id} notification={n} onDismiss={dismiss} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  notification: {
    id: string
    displayName: string
    type: 'join' | 'leave' | 'raise-hand'
  }
  onDismiss: (id: string) => void
}

function ToastItem({ notification, onDismiss }: ToastItemProps) {
  const { id, displayName, type } = notification

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [id, onDismiss])

  const getToastDetails = () => {
    switch (type) {
      case 'join':
        return {
          icon: <LogIn size={15} style={{ color: '#34a853' }} />,
          color: '#34a853',
          text: 'joined the meeting'
        }
      case 'leave':
        return {
          icon: <LogOut size={15} style={{ color: '#ea4335' }} />,
          color: '#ea4335',
          text: 'left the meeting'
        }
      case 'raise-hand':
        return {
          icon: <Hand size={15} style={{ color: '#fbbf24', fill: '#fbbf24' }} />,
          color: '#fbbf24',
          text: 'raised a hand'
        }
    }
  }

  const details = getToastDetails()

  return (
    <div style={{
      pointerEvents: 'all',
      background: '#1e293b',
      color: '#fff',
      border: '1px solid #334155',
      padding: '0.75rem 1rem',
      borderRadius: '0.5rem',
      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.625rem',
      fontSize: '0.8125rem',
      fontWeight: 500,
      animation: 'slideIn 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
    }}>
      {details.icon}
      <span>
        <strong style={{ color: details.color }}>{displayName}</strong>{' '}
        {details.text}
      </span>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
