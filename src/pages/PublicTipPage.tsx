import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import QRCode from 'react-qr-code';
import { Pix } from '../lib/pix';
import { Check, Copy, ListMusic, Music, ChevronDown, ChevronUp } from 'lucide-react';

export default function PublicTipPage() {
    const [searchParams] = useSearchParams();
    const artistId = searchParams.get('artistId');
    const [artist, setArtist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState('');
    const [step, setStep] = useState(1);
    const [songRequest, setSongRequest] = useState({
        songTitle: '',
        artistName: '',
        cover: '',
        userName: '',
        message: ''
    });
    const [pixPayload, setPixPayload] = useState('');
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);

    const [paymentId, setPaymentId] = useState<string | null>(null);
    const [isAutomaticPayment, setIsAutomaticPayment] = useState(false);

    useEffect(() => {
        if (artistId) {
            fetchArtist(artistId);
            fetchPlaylists(artistId);
        }
    }, [artistId]);

    // Polling for payment status
    useEffect(() => {
        let interval: any;
        if (paymentId && step === 2 && artist?.mercadopagoAccessToken) {
            interval = setInterval(async () => {
                try {
                    const response = await fetch(`/api/mercadopago/v1/payments/${paymentId}`, {
                        headers: {
                            'Authorization': `Bearer ${artist.mercadopagoAccessToken}`
                        }
                    });
                    const data = await response.json();
                    if (data.status === 'approved') {
                        clearInterval(interval);
                        handleFinalizeOrder();
                    }
                } catch (error) {
                    console.error("Error checking payment status:", error);
                }
            }, 3000); // Check every 3 seconds
        }
        return () => clearInterval(interval);
    }, [paymentId, step, artist]);

    const fetchArtist = async (id: string) => {
        try {
            const docRef = doc(db, 'users', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setArtist({ id: docSnap.id, ...docSnap.data() });
            }
        } catch (error) {
            console.error("Error fetching artist:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlaylists = async (id: string) => {
        try {
            const q = query(collection(db, 'playlists'), where('userId', '==', id));
            const snapshot = await getDocs(q);
            const fetchedPlaylists = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
                const playlistData = { id: docSnapshot.id, ...docSnapshot.data() };
                // Fetch songs for each playlist
                const songsQ = query(collection(db, 'playlists', docSnapshot.id, 'songs'));
                const songsSnapshot = await getDocs(songsQ);
                const songs = songsSnapshot.docs.map(s => ({ id: s.id, ...s.data() }));
                return { ...playlistData, songsList: songs };
            }));
            setPlaylists(fetchedPlaylists);
        } catch (error) {
            console.error("Error fetching playlists:", error);
        }
    };

    const handleAmountSelect = (amount: number) => {
        setSelectedAmount(amount);
        setCustomAmount('');
        generatePix(amount);
    };

    const generatePix = async (amount: number) => {
        setPaymentId(null);
        if (artist?.mercadopagoAccessToken) {
            // Automatic Mode
            setIsAutomaticPayment(true);
            try {
                // Generate a unique email to avoid "payer email" validation errors in production
                const uniqueEmail = `payment_${Date.now()}@musicalmenu.com`;

                const response = await fetch('/api/mercadopago/v1/payments', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${artist.mercadopagoAccessToken.trim()}`,
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key': crypto.randomUUID()
                    },
                    body: JSON.stringify({
                        transaction_amount: amount,
                        description: 'Gorjeta Musical',
                        payment_method_id: 'pix',
                        payer: {
                            email: uniqueEmail,
                            first_name: songRequest.userName || 'Visitante'
                        }
                    })
                });

                const data = await response.json();
                if (data.id) {
                    setPaymentId(data.id);
                    setPixPayload(data.point_of_interaction.transaction_data.qr_code);
                } else {
                    console.error("Mercado Pago Error:", data);
                    const errorMessage = data.message || data.error || "Verifique o Access Token";
                    alert(`Erro no Mercado Pago: ${errorMessage}. Usando modo manual.`);
                    fallbackGeneratePix(amount);
                }
            } catch (error) {
                console.error("Error creating payment:", error);
                alert("Erro de conexão com Mercado Pago. Usando modo manual.");
                fallbackGeneratePix(amount);
            }
        } else {
            fallbackGeneratePix(amount);
        }
    };

    const fallbackGeneratePix = (amount: number) => {
        setIsAutomaticPayment(false);
        if (!artist?.pixKey || !artist?.beneficiaryName) {
            alert("O artista ainda não configurou os dados para recebimento via PIX.");
            return;
        }
        const pix = new Pix(
            artist.pixKey,
            artist.beneficiaryName,
            'Cidade', // Default city
            '***',
            'Gorjeta Musical',
            amount.toFixed(2)
        );
        setPixPayload(pix.getPayload());
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStep(2); // Move to payment step
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleFinalizeOrder = async () => {
        if (!artistId) return;

        try {
            await addDoc(collection(db, 'requests'), {
                userId: artistId,
                ...songRequest,
                amount: selectedAmount || parseFloat(customAmount) || 0,
                createdAt: new Date().toISOString(),
                status: 'confirmed'
            });
            setStep(3); // Success step
        } catch (error) {
            console.error("Error submitting request:", error);
            alert("Erro ao enviar pedido.");
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
    if (!artist) return <div className="min-h-screen flex items-center justify-center">Artista não encontrado.</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h1 className="text-xl font-bold text-center text-gray-800">Pedir Música</h1>
                    <p className="text-center text-sm text-gray-500 mt-1">para {artist.displayName || 'o Artista'}</p>
                </div>

                <div className="p-6">
                    {/* Stepper */}
                    <div className="flex items-center justify-center mb-8 gap-2">
                        <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
                        <div className={`w-8 h-0.5 ${step >= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
                        <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
                        <div className={`w-8 h-0.5 ${step >= 3 ? 'bg-green-500' : 'bg-gray-200'}`} />
                        <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-green-500' : 'bg-gray-200'}`} />
                    </div>

                    {step === 1 && (
                        <form onSubmit={handleFormSubmit} className="space-y-4 animate-in slide-in-from-right-4">
                            {!songRequest.songTitle ? (
                                <div className="text-center p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Music className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <p className="text-gray-600 font-medium">Escolha uma música do repertório abaixo</p>
                                    <p className="text-sm text-gray-400 mt-1">Selecione uma música da lista para fazer seu pedido</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-3">
                                            {songRequest.cover ? (
                                                <img src={songRequest.cover} alt={songRequest.songTitle} className="w-12 h-12 rounded-md object-cover shadow-sm" />
                                            ) : (
                                                <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center text-primary">
                                                    <Music size={20} />
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-primary/60 font-medium uppercase tracking-wider mb-0.5">Música Selecionada</p>
                                                <p className="font-bold text-gray-800 line-clamp-1">{songRequest.songTitle}</p>
                                                <p className="text-sm text-gray-500 line-clamp-1">{songRequest.artistName}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSongRequest(prev => ({ ...prev, songTitle: '', artistName: '', cover: '' }))}
                                            className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors ml-2"
                                        >
                                            Trocar
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Seu nome</label>
                                        <input
                                            required
                                            type="text"
                                            className="input"
                                            placeholder="Como quer ser chamado?"
                                            value={songRequest.userName}
                                            onChange={e => setSongRequest({ ...songRequest, userName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Mensagem (opcional)</label>
                                        <textarea
                                            className="input min-h-[80px]"
                                            placeholder="Mande um recado para o artista..."
                                            value={songRequest.message}
                                            onChange={e => setSongRequest({ ...songRequest, message: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="submit"
                                            className="btn btn-primary w-full"
                                        >
                                            Confirmar Pedido
                                        </button>
                                    </div>
                                </>
                            )}
                        </form>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                                <h3 className="font-bold text-green-800 mb-1">Apoie o artista com um pix pelo app</h3>
                                <p className="text-sm text-green-700">Uma pequena ajuda faz toda diferença!</p>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {(artist?.pixValues || [10, 20, 30]).map((amount: number) => (
                                    <button
                                        key={amount}
                                        onClick={() => handleAmountSelect(amount)}
                                        className={`py-3 rounded-lg border font-medium transition-all ${selectedAmount === amount
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-gray-200 hover:border-green-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        R$ {amount}
                                    </button>
                                ))}
                            </div>

                            {selectedAmount && pixPayload && (
                                <div className="text-center space-y-4 pt-4 border-t border-gray-100">
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 inline-block">
                                        <QRCode value={pixPayload} size={180} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium mb-2">Pix Copia e Cola</p>
                                        <div className="flex gap-2">
                                            <input
                                                readOnly
                                                value={pixPayload}
                                                className="input text-xs flex-1"
                                            />
                                            <button
                                                onClick={() => navigator.clipboard.writeText(pixPayload)}
                                                className="btn btn-outline p-2"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {isAutomaticPayment ? (
                                        <div className="flex items-center justify-center gap-2 text-primary font-medium animate-pulse">
                                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                                            Aguardando confirmação do pagamento...
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleFinalizeOrder}
                                            className="btn btn-primary w-full"
                                        >
                                            Já fiz o Pix, enviar pedido
                                        </button>
                                    )}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="btn btn-outline w-full mt-4"
                            >
                                Voltar
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="text-center py-10 animate-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check size={32} />
                            </div>
                            <h2 className="text-xl font-bold mb-2">Pedido Enviado!</h2>
                            <p className="text-gray-500 mb-6">O artista já recebeu seu pedido e sua contribuição.</p>
                            <button
                                onClick={() => {
                                    setStep(1);
                                    setSelectedAmount(null);
                                    setSongRequest({ songTitle: '', artistName: '', cover: '', userName: '', message: '' });
                                }}
                                className="btn btn-outline"
                            >
                                Fazer outro pedido
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Playlists Section */}
            {playlists.length > 0 && (
                <div className="max-w-md mx-auto mt-8">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 px-2">
                        <ListMusic className="text-primary" />
                        Repertório Disponível
                    </h2>
                    <div className="space-y-3">
                        {playlists.map((playlist) => (
                            <div key={playlist.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                                <button
                                    onClick={() => setExpandedPlaylist(expandedPlaylist === playlist.id ? null : playlist.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                            <Music size={20} />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-bold text-gray-800">{playlist.name}</h3>
                                            <p className="text-xs text-gray-500">{playlist.songsList?.length || 0} músicas</p>
                                        </div>
                                    </div>
                                    {expandedPlaylist === playlist.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                                </button>

                                {expandedPlaylist === playlist.id && (
                                    <div className="border-t border-gray-100 bg-gray-50/50">
                                        {playlist.songsList && playlist.songsList.length > 0 ? (
                                            <div className="divide-y divide-gray-100">
                                                {playlist.songsList.map((song: any) => (
                                                    <div key={song.id} className="p-3 pl-4 flex justify-between items-center hover:bg-white transition-colors group">
                                                        <div className="flex items-center gap-3">
                                                            {song.cover ? (
                                                                <img src={song.cover} alt={song.title} className="w-10 h-10 rounded object-cover shadow-sm" />
                                                            ) : (
                                                                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                                                                    <Music size={16} />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="font-medium text-sm text-gray-800 line-clamp-1">{song.title}</p>
                                                                <p className="text-xs text-gray-500 line-clamp-1">{song.artist}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setSongRequest(prev => ({ ...prev, songTitle: song.title, artistName: song.artist, cover: song.cover || '' }));
                                                                setStep(1); // Ensure we are on the form step
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors font-medium"
                                                        >
                                                            Pedir
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center text-sm text-gray-400">
                                                Nenhuma música nesta playlist.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
