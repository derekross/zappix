import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export function RemoteLoginSuccess() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [checkCount, setCheckCount] = useState(0);
  const [status, setStatus] = useState<'checking' | 'success' | 'timeout'>('checking');

  useEffect(() => {
    if (user) {
      setStatus('success');
      const timer = setTimeout(() => {
        navigate('/home', { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }

    if (checkCount < 20) {
      const timer = setTimeout(() => {
        setCheckCount(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setStatus('timeout');
    }
  }, [user, checkCount, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        {status === 'checking' && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
            <h1 className="text-2xl font-bold">Completing Login...</h1>
            <p className="text-muted-foreground">Verifying your remote signer connection</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
            <h1 className="text-2xl font-bold">Login Successful!</h1>
            <p className="text-muted-foreground">Redirecting you to the app...</p>
          </>
        )}

        {status === 'timeout' && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-yellow-500" />
            <h1 className="text-2xl font-bold">Session Not Detected</h1>
            <p className="text-muted-foreground">The login session wasn't found. This can happen if:</p>
            <ul className="text-muted-foreground text-sm text-left list-disc list-inside space-y-1">
              <li>The signer app didn't complete authorization</li>
              <li>You opened this page in a different browser</li>
              <li>The session expired</li>
            </ul>
            <button
              onClick={() => navigate('/home', { replace: true })}
              className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              Go to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default RemoteLoginSuccess;
