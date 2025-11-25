import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Music, ArrowRight } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            navigate('/');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Este email já está em uso.');
            } else if (err.code === 'auth/invalid-credential') {
                setError('Credenciais inválidas.');
            } else if (err.code === 'auth/weak-password') {
                setError('A senha deve ter pelo menos 6 caracteres.');
            } else {
                setError('Ocorreu um erro. Tente novamente.');
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-surface relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />

            <div className="card glass w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500 shadow-xl">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-secondary mb-4 shadow-lg">
                        <Music className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">{isSignUp ? 'Criar Conta' : 'Bem-vindo de volta'}</h1>
                    <p className="text-text-muted">
                        {isSignUp ? 'Preencha os dados para começar' : 'Acesse sua conta para gerenciar playlists'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-text-muted">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input"
                            placeholder="seu@email.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-text-muted">Senha</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && <p className="text-error text-sm text-center">{error}</p>}

                    <button type="submit" className="btn btn-primary w-full group">
                        {isSignUp ? 'Cadastrar' : 'Entrar'}
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-text-muted">
                    <p>
                        {isSignUp ? 'Já tem uma conta?' : 'Ainda não tem conta?'}
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-primary hover:underline ml-1 font-medium"
                        >
                            {isSignUp ? 'Fazer login' : 'Cadastre-se'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
