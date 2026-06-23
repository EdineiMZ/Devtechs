'use client';

import { useState } from 'react';

import { EmpresasTab } from './empresas-tab';
import { KeysTab } from './keys-tab';
import { PaymentsTab } from './payments-tab';
import { PrecosTab } from './precos-tab';
import { TelemetryTab } from './telemetry-tab';

type Tab = 'keys' | 'empresas' | 'payments' | 'precos' | 'telemetry';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'keys', label: 'Keys' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'payments', label: 'Pagamentos' },
  { id: 'precos', label: 'Preços' },
  { id: 'telemetry', label: 'Telemetria' },
];

export function AgrivorPanel(): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('keys');

  return (
    <div>
      <nav aria-label="Seções AGRIVOR" className="mb-6 flex gap-1 border-b border-white/8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={
              'relative -mb-px px-4 py-2 text-sm font-medium transition-colors border-b-2 ' +
              (activeTab === tab.id
                ? 'border-sky-500 text-foreground'
                : 'border-transparent text-ash hover:text-foreground')
            }
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'keys' && <KeysTab />}
      {activeTab === 'empresas' && <EmpresasTab />}
      {activeTab === 'payments' && <PaymentsTab />}
      {activeTab === 'precos' && <PrecosTab />}
      {activeTab === 'telemetry' && <TelemetryTab />}
    </div>
  );
}
