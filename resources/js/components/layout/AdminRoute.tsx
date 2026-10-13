import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// /dashboard bukan route react-router lagi (halaman Inertia) -> harus full page load.
function HardRedirect({ to }: { to: string }) {
    useEffect(() => {
        window.location.replace(to);
    }, [to]);
    return null;
}

export default function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    if (!user) return <Navigate to="/login" replace />;

    if (user.role !== 'admin') {
        return <HardRedirect to="/dashboard" />;
    }

    return <>{children}</>;
}