'use client';

import { useState } from 'react';

import { KeysTab } from './keys-tab';
import { PaymentsTab } from './payments-tab';
import { TelemetryTab } from './telemetry-tab';

type Tab = 'keys' | 'payments' | 'telemetry';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'keys', label: 'Keys' },
  { id: 'payments', label: 'Pagamentos' },
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
      {activeTab === 'payments' && <PaymentsTab />}
      {activeTab === 'telemetry' && <TelemetryTab />}
    </div>
  );
}
