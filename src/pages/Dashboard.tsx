import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut, deleteUser } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, updateDoc, increment, arrayUnion, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ListMusic, Music, QrCode, Settings, Trash2, ArrowRight, Plus, Check, Copy, ExternalLink, Download } from 'lucide-react';
import QRCode from 'react-qr-code';
import clsx from 'clsx';

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState('playlists');
    const [user, setUser] = useState<any>(null);
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
    const [showAddSongModal, setShowAddSongModal] = useState(false);
    const [newSongTitle, setNewSongTitle] = useState('');
    const [newSongArtist, setNewSongArtist] = useState('');
    const [newSongCover, setNewSongCover] = useState('');
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
    const [isAddingSong, setIsAddingSong] = useState(false);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                navigate('/login');
            } else {
                setUser(currentUser);
                fetchPlaylists(currentUser.uid);
                fetchUserSettings(currentUser.uid);
            }
            // setLoading(false);
        });
        return () => unsubscribe();
    }, [navigate]);

    const fetchPlaylists = async (userId: string) => {
        try {
            const q = query(collection(db, 'playlists'), where('userId', '==', userId));
            const snapshot = await getDocs(q);
            const fetchedPlaylists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by createdAt desc if available, or name
            fetchedPlaylists.sort((a: any, b: any) => {
                if (a.createdAt && b.createdAt) {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                }
                return a.name.localeCompare(b.name);
            });
            setPlaylists(fetchedPlaylists);
        } catch (error) {
            console.error("Error fetching playlists:", error);
        }
    };

    // ... (existing useEffects)

    const handleCreatePlaylist = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newPlaylistName.trim()) {
            alert("Por favor, digite um nome para a playlist.");
            return;
        }

        if (!user) {
            alert("Você precisa estar logado para criar uma playlist.");
            return;
        }

        setIsCreatingPlaylist(true);
        try {
            const newPlaylist = {
                name: newPlaylistName,
                userId: user.uid,
                songs: 0,
                createdAt: new Date().toISOString()
            };

            const docRef = await addDoc(collection(db, 'playlists'), newPlaylist);
            // Optimistic update
            const createdPlaylist = { id: docRef.id, ...newPlaylist };
            setPlaylists(prev => [createdPlaylist, ...prev]);

            setNewPlaylistName('');
            setShowNewPlaylistModal(false);
        } catch (error: any) {
            console.error("Error creating playlist:", error);
            if (error.code === 'unavailable' || error.message?.includes('offline')) {
                alert("Erro de conexão: O banco de dados não está acessível. Verifique se você tem algum bloqueador de anúncios ou extensão que possa estar bloqueando o Firebase.");
            } else {
                alert("Erro ao criar playlist. Verifique o console para mais detalhes.");
            }
        } finally {
            setIsCreatingPlaylist(false);
        }
    };

    const handleAddSong = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlaylist || !newSongTitle.trim() || !newSongArtist.trim()) return;

        setIsAddingSong(true);
        try {
            const newSong = {
                title: newSongTitle,
                artist: newSongArtist,
                cover: newSongCover || '',
                createdAt: new Date().toISOString()
            };

            // Add song to 'songs' subcollection of the playlist
            await addDoc(collection(db, 'playlists', selectedPlaylist.id, 'songs'), newSong);

            // Update song count and covers on the playlist document
            const playlistRef = doc(db, 'playlists', selectedPlaylist.id);
            const updateData: any = {
                songs: increment(1)
            };
            if (newSongCover) {
                updateData.covers = arrayUnion(newSongCover);
            }
            await updateDoc(playlistRef, updateData);

            // Update local state
            setPlaylists(prevPlaylists =>
                prevPlaylists.map(p =>
                    p.id === selectedPlaylist.id ? {
                        ...p,
                        songs: (p.songs || 0) + 1,
                        covers: newSongCover ? [...(p.covers || []), newSongCover] : (p.covers || [])
                    } : p
                )
            );

            // Update selected playlist state as well if needed
            setSelectedPlaylist((prev: any) => ({
                ...prev,
                songs: (prev.songs || 0) + 1,
                covers: newSongCover ? [...(prev.covers || []), newSongCover] : (prev.covers || [])
            }));

            setNewSongTitle('');
            setNewSongArtist('');
            setNewSongCover('');
            setShowAddSongModal(false);
            alert('Música adicionada com sucesso!');
        } catch (error: any) {
            console.error("Error adding song:", error);
            if (error.code === 'unavailable' || error.message?.includes('offline')) {
                alert("Erro de conexão: O banco de dados não está acessível. Verifique se você tem algum bloqueador de anúncios ou extensão que possa estar bloqueando o Firebase.");
            } else {
                alert("Erro ao adicionar música. Tente novamente.");
            }
        } finally {
            setIsAddingSong(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const handlePlaylistClick = (playlist: any) => {
        setSelectedPlaylist(playlist);
    };

    const handleDeletePlaylist = async (playlistId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Tem certeza que deseja excluir esta playlist?")) return;

        try {
            await deleteDoc(doc(db, 'playlists', playlistId));
            setPlaylists(prev => prev.filter(p => p.id !== playlistId));
            if (selectedPlaylist?.id === playlistId) {
                setSelectedPlaylist(null);
            }
            alert("Playlist excluída com sucesso!");
        } catch (error) {
            console.error("Error deleting playlist:", error);
            alert("Erro ao excluir playlist.");
        }
    };


    const [playlistSongs, setPlaylistSongs] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [savingSettings, setSavingSettings] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);



    const [mercadopagoAccessToken, setMercadopagoAccessToken] = useState('');

    const searchMusic = async (term: string) => {
        if (!term.trim()) return;
        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5`);
            const data = await response.json();
            setSearchResults(data.results);
        } catch (error) {
            console.error("Error searching music:", error);
            setSearchResults([]);
        }
    };

    const handleSimulateRequest = async () => {
        if (!user) return;
        try {
            await addDoc(collection(db, 'requests'), {
                userId: user.uid,
                songTitle: 'Música de Teste',
                artistName: 'Artista Teste',
                userName: 'Usuário Teste',
                message: 'Isso é um teste!',
                amount: 5.00,
                cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop',
                createdAt: new Date().toISOString(),
                status: 'confirmed'
            });
        } catch (error) {
            console.error("Error simulating request:", error);
        }
    };

    const [pixValues, setPixValues] = useState<[number, number, number]>([10, 20, 30]);

    // ... (existing code)

    const fetchUserSettings = async (userId: string) => {
        try {
            const docRef = doc(db, 'users', userId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMercadopagoAccessToken(data.mercadopagoAccessToken || '');
                if (data.pixValues && Array.isArray(data.pixValues) && data.pixValues.length === 3) {
                    setPixValues(data.pixValues as [number, number, number]);
                }
            } else {
                // Create document if it doesn't exist
                await setDoc(docRef, {
                    createdAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error("Error fetching user settings:", error);
        }
    };

    const handleSaveSettings = async () => {
        if (!user) return;
        setSavingSettings(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            // Use setDoc with merge: true to create if not exists or update
            await setDoc(userRef, {
                mercadopagoAccessToken,
                pixValues,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            alert("Configurações salvas com sucesso!");
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Erro ao salvar configurações.");
        } finally {
            setSavingSettings(false);
        }
    };

    const handleDeleteAccount = () => {
        setShowDeleteAccountModal(true);
    };

    const confirmDeleteAccount = async () => {
        if (!user) return;

        setSavingSettings(true);

        try {
            // 1. Delete User Playlists and Songs
            const playlistsQuery = query(collection(db, 'playlists'), where('userId', '==', user.uid));
            const playlistsSnapshot = await getDocs(playlistsQuery);

            for (const playlistDoc of playlistsSnapshot.docs) {
                // Delete songs in playlist
                const songsSnapshot = await getDocs(collection(db, 'playlists', playlistDoc.id, 'songs'));
                for (const songDoc of songsSnapshot.docs) {
                    await deleteDoc(doc(db, 'playlists', playlistDoc.id, 'songs', songDoc.id));
                }
                // Delete playlist
                await deleteDoc(doc(db, 'playlists', playlistDoc.id));
            }

            // 2. Delete User Requests
            const requestsQuery = query(collection(db, 'requests'), where('userId', '==', user.uid));
            const requestsSnapshot = await getDocs(requestsQuery);
            for (const requestDoc of requestsSnapshot.docs) {
                await deleteDoc(doc(db, 'requests', requestDoc.id));
            }

            // 3. Delete User Document
            await deleteDoc(doc(db, 'users', user.uid));

            // 4. Delete Auth User
            await deleteUser(user);

            alert("Conta excluída com sucesso.");
            navigate('/login');

        } catch (error: any) {
            console.error("Error deleting account:", error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Por segurança, faça login novamente antes de excluir sua conta.");
                await signOut(auth);
                navigate('/login');
            } else {
                alert("Erro ao excluir conta: " + error.message);
            }
        } finally {
            setSavingSettings(false);
        }
    };

    const handleDeleteSong = async (songId: string) => {
        if (!selectedPlaylist || !window.confirm("Tem certeza que deseja remover esta música?")) return;

        try {
            await deleteDoc(doc(db, 'playlists', selectedPlaylist.id, 'songs', songId));

            // Update song count on playlist
            const playlistRef = doc(db, 'playlists', selectedPlaylist.id);
            await updateDoc(playlistRef, {
                songs: increment(-1)
            });

            // Update local state
            setPlaylistSongs(prev => prev.filter(s => s.id !== songId));
            setPlaylists(prev => prev.map(p => {
                if (p.id === selectedPlaylist.id) {
                    return {
                        ...p,
                        songs: Math.max(0, (p.songs || 0) - 1)
                    };
                }
                return p;
            }));

            // Update selected playlist state
            setSelectedPlaylist((prev: any) => ({
                ...prev,
                songs: Math.max(0, (prev.songs || 0) - 1)
            }));

            alert("Música removida com sucesso!");
        } catch (error) {
            console.error("Error deleting song:", error);
            alert("Erro ao remover música.");
        }
    };

    const handleCompleteRequest = async (requestId: string) => {
        try {
            await updateDoc(doc(db, 'requests', requestId), {
                status: 'completed',
                completedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error completing request:", error);
            alert("Erro ao concluir pedido.");
        }
    };

    const handleDeleteRequest = async (requestId: string) => {
        try {
            await deleteDoc(doc(db, 'requests', requestId));
        } catch (error) {
            console.error("Error deleting request:", error);
            alert("Erro ao excluir pedido.");
        }
    };

    const handleDeleteAllCompleted = () => {
        setShowDeleteAllModal(true);
    };

    const confirmDeleteAllCompleted = async () => {
        const completedRequests = requests.filter((r: any) => r.status === 'completed');
        try {
            await Promise.all(completedRequests.map(req => deleteDoc(doc(db, 'requests', req.id))));
            setShowDeleteAllModal(false);
        } catch (error) {
            console.error("Error deleting all completed requests:", error);
            alert("Erro ao excluir pedidos.");
        }
    };

    useEffect(() => {
        if (selectedPlaylist) {
            const fetchSongs = async () => {
                try {
                    const q = query(collection(db, 'playlists', selectedPlaylist.id, 'songs'));
                    const snapshot = await getDocs(q);
                    const songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setPlaylistSongs(songs);
                } catch (error) {
                    console.error("Error fetching songs:", error);
                }
            };
            fetchSongs();
        } else {
            setPlaylistSongs([]);
        }
    }, [selectedPlaylist]);

    const [isSoundEnabled, setIsSoundEnabled] = useState(true);
    const prevConfirmedCount = React.useRef(0);
    const isFirstLoad = React.useRef(true);

    const playNotificationSound = () => {
        if (!isSoundEnabled) return;
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    };

    useEffect(() => {
        if (!user) return;

        // Reset first load on user change
        isFirstLoad.current = true;

        const q = query(
            collection(db, 'requests'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort in memory
            newRequests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setRequests(newRequests);

            // Check for new confirmed requests
            const confirmedCount = newRequests.filter((r: any) => r.status === 'confirmed').length;

            if (!isFirstLoad.current && confirmedCount > prevConfirmedCount.current) {
                playNotificationSound();
            }

            prevConfirmedCount.current = confirmedCount;
            if (isFirstLoad.current) isFirstLoad.current = false;

        }, (error) => {
            console.error("Error in snapshot listener:", error);
        });

        return () => unsubscribe();
    }, [user, isSoundEnabled]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            <aside className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex items-center justify-around p-2">
                <NavItem icon={<ListMusic size={24} />} label="Playlists" active={activeTab === 'playlists'} onClick={() => setActiveTab('playlists')} />
                <NavItem icon={<Music size={24} />} label="Pedidos" active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
                <NavItem icon={<QrCode size={24} />} label="QR Code" active={activeTab === 'qrcode'} onClick={() => setActiveTab('qrcode')} />
                <NavItem icon={<Settings size={24} />} label="Config" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
            </aside>

            <main className="flex-1 p-4 md:p-8 pb-24 max-w-7xl mx-auto w-full">
                <header className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            {activeTab === 'playlists' && 'Minhas Playlists'}
                            {activeTab === 'requests' && 'Pedidos de Música'}
                            {activeTab === 'qrcode' && 'Configurar QR Code'}
                            {activeTab === 'config' && 'Configurações'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:block text-right">
                            <p className="text-sm font-bold text-gray-700">{user?.displayName || 'Usuário'}</p>
                            <p className="text-xs text-text-muted">{user?.email}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {user?.displayName?.[0] || 'U'}
                        </div>
                    </div>
                </header>

                {activeTab === 'playlists' && !selectedPlaylist && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {playlists.map((playlist) => (
                            <div
                                key={playlist.id}
                                onClick={() => handlePlaylistClick(playlist)}
                                className="group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden border border-gray-100"
                            >
                                <button
                                    onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                                    className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all z-10"
                                    title="Excluir playlist"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div className="aspect-square w-full bg-gray-100 relative border-b border-gray-100">
                                    {playlist.covers && playlist.covers.length >= 4 ? (
                                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                                            {playlist.covers.slice(0, 4).map((cover: string, i: number) => (
                                                <img key={i} src={cover} alt="" className="w-full h-full object-cover" />
                                            ))}
                                        </div>
                                    ) : playlist.covers && playlist.covers.length > 0 ? (
                                        <img src={playlist.covers[0]} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                                            <Music size={48} />
                                        </div>
                                    )}
                                </div>
                                <div className="p-5">
                                    <h3 className="font-bold text-xl text-gray-800 mb-1 group-hover:text-primary transition-colors">{playlist.name}</h3>
                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                                            {playlist.songs} músicas
                                        </span>
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                            <ArrowRight size={16} className="text-primary" />
                                        </div>
                                    </div>
                                </div>
                            </div >
                        ))
                        }

                        {/* Add New Playlist Card (Visual Cue) */}
                        <button
                            onClick={() => setShowNewPlaylistModal(true)}
                            className="group relative overflow-hidden rounded-xl border-2 border-dashed border-gray-200 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center min-h-[200px]"
                        >
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Plus className="text-primary w-6 h-6" />
                            </div>
                            <span className="font-medium text-gray-600 group-hover:text-primary">Criar Nova Playlist</span>
                        </button>
                    </div >
                )
                }

                {
                    activeTab === 'playlists' && selectedPlaylist && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setSelectedPlaylist(null)}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <ArrowRight className="rotate-180 text-gray-600" size={20} />
                                    </button>
                                    <h2 className="text-xl font-bold text-gray-800">{selectedPlaylist.name}</h2>
                                </div>
                                <button
                                    onClick={() => setShowAddSongModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
                                >
                                    <Plus size={18} />
                                    <span className="hidden md:inline">Adicionar Música</span>
                                </button>
                            </div>
                            {playlistSongs.length === 0 ? (
                                <div className="card">
                                    <div className="text-center py-10 text-text-muted">
                                        <Music className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>Nenhuma música adicionada ainda.</p>
                                        <button
                                            onClick={() => setShowAddSongModal(true)}
                                            className="text-primary hover:underline mt-2"
                                        >
                                            Adicionar primeira música
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {playlistSongs.map((song) => (
                                        <div key={song.id} className="group flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-primary/20 hover:shadow-md transition-all duration-200">
                                            <div className="flex items-center gap-4">
                                                {song.cover ? (
                                                    <img src={song.cover} alt={song.title} className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-bold text-sm">
                                                        <Music size={18} />
                                                    </div>
                                                )}
                                                <div>
                                                    <h4 className="font-bold text-gray-800">{song.title}</h4>
                                                    <p className="text-sm text-gray-500">{song.artist}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteSong(song.id)}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                                title="Remover música"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                }

                {
                    activeTab === 'requests' && (
                        <div className="space-y-8">
                            {/* Pending Requests */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-xl font-semibold text-gray-800">Últimos Pedidos</h2>
                                        <span className="flex items-center gap-1.5 px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full animate-pulse">
                                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                            AO VIVO
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                                            className={`p-2 rounded-full transition-colors ${isSoundEnabled ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}
                                            title={isSoundEnabled ? "Som ativado" : "Som desativado"}
                                        >
                                            {isSoundEnabled ? <Music size={16} /> : <div className="relative"><Music size={16} /><div className="absolute inset-0 border-t border-gray-400 rotate-45 top-1/2"></div></div>}
                                        </button>
                                        <button onClick={handleSimulateRequest} className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                            + Simular Pedido
                                        </button>
                                    </div>
                                </div>

                                {requests.filter((r: any) => r.status === 'confirmed').length === 0 ? (
                                    <div className="card text-center py-12 text-text-muted bg-gray-50 border-dashed">
                                        <Music className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p className="text-lg font-medium">Nenhum pedido confirmado</p>
                                        <p className="text-sm opacity-70">Os novos pedidos aparecerão aqui</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {requests.filter((r: any) => r.status === 'confirmed').map((req: any) => (
                                            <div key={req.id} className="card flex justify-between items-center p-4 animate-in slide-in-from-bottom-2 border-l-4 border-l-primary">
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            {req.cover ? (
                                                                <img src={req.cover} alt={req.songTitle} className="w-12 h-12 rounded-md object-cover shadow-sm" />
                                                            ) : (
                                                                <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center text-primary">
                                                                    <Music size={20} />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <h3 className="font-bold text-lg text-gray-800 line-clamp-1">{req.songTitle}</h3>
                                                                <p className="text-primary font-medium line-clamp-1">{req.artistName}</p>
                                                            </div>
                                                        </div>
                                                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ml-2">
                                                            R$ {req.amount?.toFixed(2)}
                                                        </span>
                                                    </div>

                                                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                                                        <span className="font-medium text-gray-700">{req.userName || 'Anônimo'}</span>
                                                        <span>•</span>
                                                        <span>{new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>

                                                    {req.message && (
                                                        <div className="mt-2 bg-gray-50 p-2 rounded text-sm text-gray-600 italic border border-gray-100">
                                                            "{req.message}"
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 ml-4">
                                                    <button
                                                        onClick={() => handleCompleteRequest(req.id)}
                                                        className="p-2 rounded-full hover:bg-green-50 text-green-600 border border-gray-200 hover:border-green-200 transition-colors"
                                                        title="Concluir Pedido"
                                                    >
                                                        <Check size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Completed Requests */}
                            {requests.filter((r: any) => r.status === 'completed').length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-semibold text-gray-800">Pedidos Concluídos</h2>
                                        <button
                                            onClick={handleDeleteAllCompleted}
                                            className="text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                                        >
                                            <Trash2 size={14} />
                                            Excluir Tudo
                                        </button>
                                    </div>
                                    <div className="grid gap-4 opacity-75">
                                        {requests.filter((r: any) => r.status === 'completed').map((req: any) => (
                                            <div key={req.id} className="card flex justify-between items-center p-4 bg-gray-50">
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            {req.cover ? (
                                                                <img src={req.cover} alt={req.songTitle} className="w-12 h-12 rounded-md object-cover shadow-sm grayscale opacity-70" />
                                                            ) : (
                                                                <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center text-gray-400">
                                                                    <Music size={20} />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <h3 className="font-bold text-lg text-gray-600 line-through line-clamp-1">{req.songTitle}</h3>
                                                                <p className="text-gray-500 font-medium line-clamp-1">{req.artistName}</p>
                                                            </div>
                                                        </div>
                                                        <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ml-2">
                                                            R$ {req.amount?.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-400">
                                                        Concluído em {req.completedAt ? new Date(req.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <button
                                                        onClick={() => handleDeleteRequest(req.id)}
                                                        className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Excluir do histórico"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }

                {
                    activeTab === 'qrcode' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="card p-6 text-center">
                                <h2 className="text-xl font-bold mb-4 flex items-center justify-center gap-2">
                                    <QrCode className="text-primary" />
                                    Seu QR Code
                                </h2>
                                <p className="text-text-muted mb-6">
                                    Compartilhe este QR Code para seus clientes fazerem pedidos e enviarem gorjetas.
                                </p>

                                <div className="w-48 h-48 bg-white mx-auto mb-4 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200 p-2">
                                    <div id="printable-qrcode">
                                        <QRCode value={`${window.location.origin}/tip?artistId=${user?.uid}`} size={160} />
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        const svg = document.getElementById("printable-qrcode")?.querySelector("svg");
                                        if (svg) {
                                            const svgData = new XMLSerializer().serializeToString(svg);
                                            const canvas = document.createElement("canvas");
                                            const ctx = canvas.getContext("2d");
                                            const img = new Image();
                                            img.onload = () => {
                                                const size = 1000; // High resolution for printing
                                                canvas.width = size;
                                                canvas.height = size;
                                                ctx?.drawImage(img, 0, 0, size, size);
                                                const pngFile = canvas.toDataURL("image/png");
                                                const downloadLink = document.createElement("a");
                                                downloadLink.download = "musical-menu-qrcode.png";
                                                downloadLink.href = pngFile;
                                                downloadLink.click();
                                            };
                                            img.src = "data:image/svg+xml;base64," + btoa(svgData);
                                        }
                                    }}
                                    className="mb-6 flex items-center gap-2 mx-auto text-primary hover:text-primary/80 font-medium transition-colors px-4 py-2 rounded-lg hover:bg-primary/5"
                                >
                                    <Download size={18} />
                                    Baixar QR Code para Imprimir
                                </button>

                                <div className="flex items-center gap-2 max-w-md mx-auto bg-green-50 p-2 rounded-lg border border-green-100">
                                    <div className="flex-1 truncate text-xs text-green-800 font-mono px-2">
                                        {`${window.location.origin}/tip?artistId=${user?.uid}`}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/tip?artistId=${user?.uid}`);
                                            alert("Link copiado!");
                                        }}
                                        className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
                                    >
                                        <Copy size={14} />
                                        Copiar Link
                                    </button>
                                    <a
                                        href={`/tip?artistId=${user?.uid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                                    >
                                        <ExternalLink size={18} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* New Playlist Modal */}
                {
                    showNewPlaylistModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="card w-full max-w-md animate-in zoom-in duration-200 shadow-2xl">
                                <div className="p-6">
                                    <h2 className="text-xl font-bold mb-4">Nova Playlist</h2>
                                    <form onSubmit={handleCreatePlaylist}>
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Nome da playlist (ex: Rock 80s)"
                                            className="input mb-6"
                                            value={newPlaylistName}
                                            onChange={e => setNewPlaylistName(e.target.value)}
                                        />
                                        <div className="flex justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPlaylistModal(false)}
                                                className="btn btn-outline"
                                                disabled={isCreatingPlaylist}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn btn-primary"
                                                disabled={isCreatingPlaylist}
                                            >
                                                {isCreatingPlaylist ? 'Criando...' : 'Criar'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Add Song Modal */}
                {
                    showAddSongModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="card w-full max-w-md animate-in zoom-in duration-200 shadow-2xl max-h-[90vh] flex flex-col">
                                <div className="p-6 border-b border-border">
                                    <h2 className="text-xl font-bold">Adicionar Música</h2>
                                </div>

                                <div className="p-6 overflow-y-auto flex-1">
                                    {/* Search Section */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium mb-2 text-text-muted">Buscar Música</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Digite o nome da música ou artista..."
                                                className="input pl-10"
                                                value={searchTerm}
                                                onChange={(e) => {
                                                    setSearchTerm(e.target.value);
                                                    if (e.target.value.length > 2) {
                                                        searchMusic(e.target.value);
                                                    } else {
                                                        setSearchResults([]);
                                                    }
                                                }}
                                            />
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                                                <Music size={18} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Search Results */}
                                    {searchResults.length > 0 && (
                                        <div className="mb-6 space-y-2">
                                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Resultados da Busca</p>
                                            <div className="space-y-2">
                                                {searchResults.map((result: any) => (
                                                    <button
                                                        key={result.trackId}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewSongTitle(result.trackName);
                                                            setNewSongArtist(result.artistName);
                                                            setNewSongCover(result.artworkUrl100);
                                                            setSearchResults([]);
                                                            setSearchTerm('');
                                                        }}
                                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors text-left border border-transparent hover:border-border group"
                                                    >
                                                        <img
                                                            src={result.artworkUrl100}
                                                            alt={result.trackName}
                                                            className="w-12 h-12 rounded bg-gray-200 object-cover"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium truncate text-gray-900">{result.trackName}</p>
                                                            <p className="text-sm text-text-muted truncate">{result.artistName}</p>
                                                        </div>
                                                        <Plus size={18} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="relative flex py-2 items-center">
                                        <div className="flex-grow border-t border-border"></div>
                                        <span className="flex-shrink-0 mx-4 text-text-muted text-xs uppercase">Ou adicione manualmente</span>
                                        <div className="flex-grow border-t border-border"></div>
                                    </div>

                                    <form onSubmit={handleAddSong} className="mt-4">
                                        <div className="space-y-4 mb-6">
                                            <div>
                                                <label className="block text-sm font-medium mb-1 text-text-muted">Título</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: Evidências"
                                                    className="input"
                                                    value={newSongTitle}
                                                    onChange={e => setNewSongTitle(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1 text-text-muted">Artista</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: Chitãozinho & Xororó"
                                                    className="input"
                                                    value={newSongArtist}
                                                    onChange={e => setNewSongArtist(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowAddSongModal(false);
                                                    setSearchTerm('');
                                                    setSearchResults([]);
                                                    setNewSongTitle('');
                                                    setNewSongArtist('');
                                                    setNewSongCover('');
                                                }}
                                                className="btn btn-outline"
                                                disabled={isAddingSong}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn btn-primary"
                                                disabled={isAddingSong}
                                            >
                                                {isAddingSong ? 'Adicionando...' : 'Adicionar'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )
                }


                {/* Config Tab */}
                {
                    activeTab === 'config' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="card p-6">
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Settings className="text-primary" />
                                    Configurações da Conta
                                </h2>

                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-sm text-gray-600 mb-2">Logado como:</p>
                                        <p className="font-medium text-gray-900">{user?.email}</p>
                                    </div>



                                    <div className="border-t border-gray-100 pt-4">
                                        <h3 className="font-semibold text-gray-800 mb-4">Valores Sugeridos (PIX)</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {[0, 1, 2].map((index) => (
                                                <div key={index}>
                                                    <label className="block text-sm font-medium mb-1 text-text-muted">Opção {index + 1}</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                                                        <input
                                                            type="number"
                                                            className="input"
                                                            style={{ paddingLeft: '40px' }}
                                                            value={pixValues[index]}
                                                            onChange={(e) => {
                                                                const newValues = [...pixValues] as [number, number, number];
                                                                newValues[index] = parseFloat(e.target.value) || 0;
                                                                setPixValues(newValues);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-4">
                                        <h3 className="font-semibold text-gray-800 mb-4">Integração Mercado Pago (Automático)</h3>

                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-text-muted">Access Token (Produção)</label>
                                            <input
                                                type="password"
                                                className="input font-mono text-sm"
                                                placeholder="APP_USR-..."
                                                value={mercadopagoAccessToken}
                                                onChange={(e) => setMercadopagoAccessToken(e.target.value)}
                                            />
                                            <p className="text-xs text-gray-400 mt-1 mb-2">
                                                Necessário para confirmação automática de pagamentos.
                                            </p>
                                            <a
                                                href="https://www.mercadopago.com.br/developers/panel"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-outline w-full text-sm py-2 flex items-center justify-center gap-2"
                                            >
                                                <ExternalLink size={16} />
                                                Obter Access Token
                                            </a>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSaveSettings}
                                        disabled={savingSettings}
                                        className="btn btn-primary w-full mt-6"
                                    >
                                        {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
                                    </button>

                                    <button
                                        onClick={handleLogout}
                                        className="btn bg-blue-600 hover:bg-blue-700 text-white w-full mt-4 border-none"
                                    >
                                        Sair da Conta
                                    </button>

                                    <div className="border-t border-gray-100 pt-6 mt-6">
                                        <button
                                            onClick={handleDeleteAccount}
                                            className="btn bg-red-600 hover:bg-red-700 text-white w-full border-none"
                                        >
                                            Excluir Minha Conta
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

            </main >

            {/* Delete All History Modal */}
            {
                showDeleteAllModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Excluir Histórico</h3>
                                <p className="text-gray-600">
                                    Tem certeza que deseja excluir todos os pedidos concluídos? Esta ação não pode ser desfeita.
                                </p>
                                <div className="flex gap-3 mt-6 justify-end">
                                    <button
                                        onClick={() => setShowDeleteAllModal(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmDeleteAllCompleted}
                                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium shadow-sm shadow-red-200"
                                    >
                                        Sim, excluir tudo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Delete Account Modal */}
            {showDeleteAccountModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-red-600 mb-2">Zona de Perigo</h3>
                            <p className="text-gray-600 mb-4">
                                Tem certeza absoluta que deseja excluir sua conta?
                            </p>
                            <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-6">
                                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                    <li>Todas as suas playlists serão apagadas.</li>
                                    <li>Todo o histórico de pedidos será perdido.</li>
                                    <li>Esta ação <strong>não pode</strong> ser desfeita.</li>
                                </ul>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowDeleteAccountModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                                    disabled={savingSettings}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDeleteAccount}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm shadow-red-200"
                                    disabled={savingSettings}
                                >
                                    {savingSettings ? 'Excluindo...' : 'Sim, excluir minha conta'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex flex-col items-center justify-center p-2 rounded-lg transition-all w-full",
                active ? "text-[#10b981]" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
        >
            <span className={clsx("mb-1", active && "scale-110")}>
                {/* Clone element to force size if needed, or rely on parent text color */}
                {icon}
            </span>
            <span className={clsx("text-[10px] md:text-sm font-medium", active ? "font-semibold" : "font-normal")}>{label}</span>
        </button>
    );
}
