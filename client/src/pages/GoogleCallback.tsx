import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      loginWithToken(token)
        .then(() => {
          toast.success('Signed in with Google!');
          navigate('/dashboard');
        })
        .catch(() => {
          toast.error('Failed to sign in with Google');
          navigate('/login');
        });
    } else {
      toast.error('Google sign-in failed');
      navigate('/login');
    }
  }, [searchParams, loginWithToken, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Signing in with Google...</p>
      </div>
    </div>
  );
}
