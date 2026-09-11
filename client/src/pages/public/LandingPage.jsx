import { useState } from 'react';
import PublicHeader from '../../components/landing/PublicHeader';
import Hero from '../../components/landing/Hero';
import Nosotros from '../../components/landing/Nosotros';
import Niveles from '../../components/landing/Niveles';
import Bienestar from '../../components/landing/Bienestar';
import Noticias from '../../components/landing/Noticias';
import Galeria from '../../components/landing/Galeria';
import InscripcionForm from '../../components/landing/InscripcionForm';
import EmpleoForm from '../../components/landing/EmpleoForm';
import OpinionesSection from '../../components/landing/OpinionesSection';
import Footer from '../../components/landing/Footer';
import LoginModal from '../../components/auth/LoginModal';
import RegisterModal from '../../components/auth/RegisterModal';

export default function LandingPage() {
  const [modal, setModal] = useState(null); // null | 'login' | 'register'

  return (
    <div>
      <PublicHeader onLogin={() => setModal('login')} />
      <Hero />
      <Nosotros />
      <Niveles />
      <Bienestar />
      <Noticias />
      <Galeria />
      <InscripcionForm />
      <EmpleoForm />
      <OpinionesSection />
      <Footer />

      <LoginModal open={modal === 'login'} onClose={() => setModal(null)} onSwitchToRegister={() => setModal('register')} />
      <RegisterModal open={modal === 'register'} onClose={() => setModal(null)} onSwitchToLogin={() => setModal('login')} />
    </div>
  );
}
