import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom'
import { JoinForm } from './components/room/JoinForm'
import { MeetingRouteWrapper } from './components/room/MeetingRouteWrapper'
import { CreateClassroomScreen } from './components/room/CreateClassroomScreen'
import type { Role } from './types/webrtc'

// Component to handle old URL redirect: ?room=abc-defg-hij -> /classroom/abc-defg-hij
function OldUrlRedirect() {
  const navigate = useNavigate()
  const location = useLocation()
  
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const oldRoom = params.get('room')
    if (oldRoom) {
      navigate(`/classroom/${oldRoom}`, { replace: true })
    }
  }, [location, navigate])
  
  return null
}

// Redirect /meeting/:roomId -> /classroom/:roomId
function MeetingRedirect() {
  const { roomId } = useParams<{ roomId: string }>()
  return <Navigate to={`/classroom/${roomId}`} replace />
}

function HomeRoute() {
  const navigate = useNavigate()
  
  const handleJoin = (roomId: string, role: Role, displayName: string, _directJoin?: boolean) => {
    navigate(`/classroom/${roomId}`, { 
      state: { 
        role, 
        displayName, 
        directJoin: false 
      } 
    })
  }

  return (
    <>
      <OldUrlRedirect />
      <JoinForm onJoin={handleJoin} />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/create-class" element={<CreateClassroomScreen />} />
        <Route path="/classroom/:roomId" element={<MeetingRouteWrapper />} />
        <Route path="/meeting/:roomId" element={<MeetingRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}