import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { inhouseService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'

import ArcadeLobbyDetail from './arcade/ArcadeLobbyDetail'
import ArcadeDraft from './arcade/ArcadeDraft'
import ArcadeVoting from './arcade/ArcadeVoting'
import ArcadeHub from './arcade/ArcadeHub'
import './arcade/arcade.css'

export default function TheArcade() {
    const { lobbyId: urlLobbyId } = useParams()
    const navigate = useNavigate()
    const { user, login } = useAuth()

    const [lobbies, setLobbies] = useState([])
    const [myLobbies, setMyLobbies] = useState([])
    const [selectedLobby, setSelectedLobby] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Fetch lobby list
    const fetchLobbies = useCallback(async () => {
        try {
            const data = await inhouseService.list()
            setLobbies(data)
        } catch (err) {
            console.error('Failed to fetch lobbies:', err)
        }
    }, [])

    // Fetch my active lobbies
    const fetchMyLobbies = useCallback(async () => {
        if (!user) return
        try {
            const data = await inhouseService.getMyLobbies()
            setMyLobbies(data)
        } catch (err) {
            console.error('Failed to fetch my lobbies:', err)
        }
    }, [user])

    // Fetch lobby detail
    const fetchDetail = useCallback(async (id) => {
        try {
            setLoading(true)
            const data = await inhouseService.getDetail(id)
            setSelectedLobby(data)
            setError(null)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    // Initial load
    useEffect(() => {
        if (urlLobbyId) {
            fetchDetail(urlLobbyId)
        } else {
            setSelectedLobby(null)
            setLoading(true)
            Promise.all([fetchLobbies(), user ? fetchMyLobbies() : Promise.resolve()])
                .finally(() => setLoading(false))
        }
    }, [urlLobbyId, fetchDetail, fetchLobbies, fetchMyLobbies, user])

    // Poll lobby detail when viewing one (5s for signup phase)
    useEffect(() => {
        if (!selectedLobby) return
        const status = selectedLobby.lobby?.status
        if (!['open', 'ready', 'active'].includes(status)) return

        const interval = setInterval(() => fetchDetail(selectedLobby.lobby.id), 5000)
        return () => clearInterval(interval)
    }, [selectedLobby, fetchDetail])

    const openLobby = (id) => navigate(`/arcade/${id}`)
    const closeLobby = () => {
        setSelectedLobby(null)
        navigate('/arcade')
        fetchLobbies()
        if (user) fetchMyLobbies()
    }

    const handleCreate = async (data) => {
        const lobby = await inhouseService.create(data)
        openLobby(lobby.id)
    }

    const handleAction = async (action, data) => {
        try {
            setError(null)
            const result = await action(data)
            // Refresh detail after any action
            if (selectedLobby) {
                await fetchDetail(selectedLobby.lobby.id)
            }
            return result
        } catch (err) {
            setError(err.message || 'Something went wrong')
            throw err
        }
    }

    // If we're viewing a specific lobby
    if (selectedLobby) {
        const status = selectedLobby.lobby.status

        // Draft view
        if (status === 'drafting') {
            return (
                <ArcadeDraft
                    lobby={selectedLobby.lobby}
                    participants={selectedLobby.participants}
                    user={user}
                    onPick={(userId) => handleAction(inhouseService.draftPick, { lobbyId: selectedLobby.lobby.id, userId })}
                    onBack={closeLobby}
                    onRefresh={() => fetchDetail(selectedLobby.lobby.id)}
                />
            )
        }

        // Voting view
        if (status === 'voting') {
            return (
                <ArcadeVoting
                    lobby={selectedLobby.lobby}
                    participants={selectedLobby.participants}
                    votes={selectedLobby.votes}
                    user={user}
                    onVote={(side) => handleAction(inhouseService.vote, { lobbyId: selectedLobby.lobby.id, side })}
                    onBack={closeLobby}
                    onRefresh={() => fetchDetail(selectedLobby.lobby.id)}
                />
            )
        }

        // Normal lobby detail (open/ready/active/completed)
        return (
            <ArcadeLobbyDetail
                lobby={selectedLobby.lobby}
                participants={selectedLobby.participants}
                votes={selectedLobby.votes}
                user={user}
                error={error}
                onJoin={(data) => handleAction(inhouseService.join, { lobbyId: selectedLobby.lobby.id, ...data })}
                onLeave={() => handleAction(inhouseService.leave, selectedLobby.lobby.id)}
                onKick={(userId) => handleAction(inhouseService.kick, { lobbyId: selectedLobby.lobby.id, userId })}
                onSetCaptains={(data) => handleAction(inhouseService.setCaptains, { lobbyId: selectedLobby.lobby.id, ...data })}
                onStartDraft={() => handleAction(inhouseService.startDraft, selectedLobby.lobby.id)}
                onStartVoting={() => handleAction(inhouseService.startVoting, selectedLobby.lobby.id)}
                onCancel={() => handleAction(inhouseService.cancel, selectedLobby.lobby.id)}
                onBack={closeLobby}
                onLogin={login}
            />
        )
    }

    // Main hub — fullscreen 2D game world
    return (
        <>
            <PageTitle title="The Arcade" />
            <Navbar />
            <ArcadeHub
                lobbies={lobbies}
                myLobbies={myLobbies}
                loading={loading}
                user={user}
                login={login}
                onSelectLobby={openLobby}
                onCreate={handleCreate}
            />
        </>
    )
}
