import { Navbar } from '@/components/ui/Navbar';
import { Hero } from '@/components/landing/Hero';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />

      {/* Feature Section */}
      <section className="py-24 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Why Aegis-12?</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">We provide cryptographic runtime security for agentic workflows.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'TEE Enclave Security', desc: 'Execute sensitive agent policies inside a secure, physically isolated hardware enclave.' },
              { title: 'Cryptographic Policy', desc: 'Enforce strict runtime constraints on transaction parameters to prevent VaultBot heists.' },
              { title: 'Solana Verifiable Logs', desc: 'Anchor all policy evaluations to the Solana blockchain for transparent, tamper-proof audits.' }
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-gray-100 dark:border-slate-700 hover:-translate-y-2 transition-transform duration-300">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 font-bold text-xl">
                  {i + 1}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
