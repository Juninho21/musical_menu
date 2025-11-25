import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, addDoc, query, where, doc, updateDoc, increment, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Plus, Music, ListMusic, Settings, LogOut, QrCode, ArrowRight, Trash2 } from 'lucide-react';
import clsx from 'clsx';

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('playlists');
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
    const [showAddSongModal, setShowAddSongModal] = useState(false);
    const [newSongTitle, setNewSongTitle] = useState('');
    const [newSongArtist, setNewSongArtist] = useState('');
    const [newSongCover, setNewSongCover] = useState('');
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
    const [isAddingSong, setIsAddingSong] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                navigate('/login');
            } else {
                setUser(currentUser);
                fetchPlaylists(currentUser.uid);
            }
            setLoading(false);
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
            alert("Playlist criada com sucesso!");
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

    // Missing state variables
    const [playlistSongs, setPlaylistSongs] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [pixKey, setPixKey] = useState('');
    const [beneficiaryName, setBeneficiaryName] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Placeholder functions
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
    const handleSimulateRequest = () => { console.log('Simulate request'); };
    const handleSaveSettings = () => { console.log('Save settings'); };
    const handleDeleteSong = (id: string) => { console.log('Delete song', id); };

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
                                    className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all z-10"
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
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
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
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold">Últimos Pedidos</h2>
                                <div className="flex gap-2">
                                    <button onClick={handleSimulateRequest} className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                        + Simular Pedido
                                    </button>
                                </div>
                            </div>

                            {requests.length === 0 ? (
                                <div className="card text-center py-20 text-text-muted">
                                    <Music className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                    <p className="text-lg">Nenhum pedido recente</p>
                                    <p className="text-sm opacity-70">Os pedidos dos clientes aparecerão aqui</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {requests.map((req: any) => (
                                        <div key={req.id} className="card flex justify-between items-center p-4 animate-in slide-in-from-bottom-2">
                                            <div>
                                                <h3 className="font-bold text-lg">{req.songTitle}</h3>
                                                <p className="text-text-muted">{req.artistName}</p>
                                                <p className="text-xs text-gray-400 mt-1">Mesa {req.tableNumber} • {new Date(req.createdAt).toLocaleTimeString()}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button className="p-2 rounded-full hover:bg-green-50 text-green-600" title="Aceitar">
                                                    <Music size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                }

                {
                    activeTab === 'qrcode' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="card p-6">
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <QrCode className="text-primary" />
                                    Configurar Gorjetas (Mercado Pago)
                                </h2>
                                <p className="text-text-muted mb-6">
                                    Configure sua conta do Mercado Pago para receber gorjetas diretamente dos clientes.
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Chave PIX (Email ou Telefone)</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Ex: seu@email.com"
                                            value={pixKey}
                                            onChange={(e) => setPixKey(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Nome do Beneficiário</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Nome que aparecerá no comprovante"
                                            value={beneficiaryName}
                                            onChange={(e) => setBeneficiaryName(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSaveSettings}
                                        disabled={savingSettings}
                                        className="btn btn-primary w-full"
                                    >
                                        {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
                                    </button>
                                </div>
                            </div>

                            <div className="card p-6 text-center opacity-50 pointer-events-none">
                                <div className="w-48 h-48 bg-surface-hover mx-auto mb-4 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                                    <QrCode className="w-16 h-16 text-text-muted" />
                                </div>
                                <h3 className="font-bold mb-2">Seu QR Code</h3>
                                <p className="text-sm text-text-muted">Configure as gorjetas acima para gerar seu QR Code</p>
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'config' && (
                        <div className="max-w-2xl mx-auto">
                            <div className="card divide-y divide-border">
                                {[
                                    {
                                        label: 'Meus Dados',
                                        icon: <Settings size={20} />,
                                        onClick: () => alert(`Email: ${user.email}\nID: ${user.uid}`)
                                    },
                                    { label: 'Segurança', icon: <Settings size={20} /> },
                                    { label: 'Assinatura', icon: <Music size={20} /> },
                                    { label: 'Métricas (Pro)', icon: <ListMusic size={20} /> },
                                    {
                                        label: 'Gorjetas',
                                        icon: <QrCode size={20} />,
                                        onClick: () => setActiveTab('qrcode')
                                    },
                                ].map((item, i) => (
                                    <button
                                        key={i}
                                        onClick={item.onClick}
                                        className="w-full flex items-center justify-between p-4 hover:bg-surface-hover transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-text-muted">{item.icon}</div>
                                            <span className="font-medium">{item.label}</span>
                                        </div>
                                        <ArrowRight size={16} className="text-text-muted" />
                                    </button>
                                ))}

                                <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 hover:bg-red-50 text-error transition-colors text-left">
                                    <div className="flex items-center gap-3">
                                        <LogOut size={20} />
                                        <span className="font-medium">Sair</span>
                                    </div>
                                </button>

                                <button className="w-full flex items-center justify-between p-4 hover:bg-red-50 text-error transition-colors text-left">
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5" /> {/* Spacer */}
                                        <span className="font-medium">Deletar Conta</span>
                                    </div>
                                </button>
                            </div>

                            <div className="mt-8 text-center text-sm text-text-muted">
                                <p>Precisa de ajuda?</p>
                                <div className="flex justify-center gap-4 mt-2">
                                    <a href="#" className="hover:text-primary">Suporte</a>
                                    <span>•</span>
                                    <a href="#" className="hover:text-primary">Termos de Uso</a>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >

            {/* New Playlist Modal */}
            {
                showNewPlaylistModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="card w-full max-w-md animate-in zoom-in duration-200 shadow-2xl">
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
