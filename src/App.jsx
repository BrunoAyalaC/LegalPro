import Navbar from './components/Navbar'
import Hero from './components/Hero'
import LogosStrip from './components/LogosStrip'
import FeaturesGrid from './components/FeaturesGrid'
import FeatureShowcase from './components/FeatureShowcase'
import LeyesPeruanas from './components/LeyesPeruanas'
import CasosReales from './components/CasosReales'
import JurisprudenciaFeed from './components/JurisprudenciaFeed'
import ValidacionLegal from './components/ValidacionLegal'
import Stats from './components/Stats'
import Pricing from './components/Pricing'
import CTABanner from './components/CTABanner'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#0A0F2E' }}>
      <Navbar />
      <main>
        <Hero />
        <LogosStrip />
        <FeaturesGrid />
        <FeatureShowcase />
        <LeyesPeruanas />
        <CasosReales />
        <JurisprudenciaFeed />
        <ValidacionLegal />
        <Stats />
        <Pricing />
        <CTABanner />
      </main>
      <Footer />
    </div>
  )
}
