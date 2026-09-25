import { useState } from 'react'
import {
  Sliders, Save, Server
} from 'lucide-react'
import { AppLayout, PageHeader } from '../components/layout/AppLayout'
import { useToast } from '../contexts/ToastContext'

export default function SettingsPage() {
  const toast = useToast()

  const [orgName, setOrgName] = useState('Dev Mavericks Outreach')
  const [defaultDuration, setDefaultDuration] = useState('48')
  const [workingHours, setWorkingHours] = useState('09:00 - 18:00')

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    toast.show('Settings saved successfully', 'success')
  }

  return (
    <AppLayout requireAdmin>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <PageHeader
          title="System Settings"
          subtitle="Configure system defaults, outreach parameters, and integration preferences"
        />

        <form onSubmit={handleSave} className="space-y-6">
          {/* General Configuration */}
          <div className="panel p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-200">
                Outreach Configuration
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-neutral-300 font-medium block mb-1">Organization / Event Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="input-text w-full"
                />
              </div>

              <div>
                <label className="text-neutral-300 font-medium block mb-1">Standard Calling Hours</label>
                <input
                  type="text"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  className="input-text w-full font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-300 font-medium block mb-1">Default Follow-Up Delay</label>
                <select
                  value={defaultDuration}
                  onChange={(e) => setDefaultDuration(e.target.value)}
                  className="input-select w-full"
                >
                  <option value="24">24 Hours (Next Day)</option>
                  <option value="48">48 Hours (2 Days)</option>
                  <option value="72">72 Hours (3 Days)</option>
                  <option value="168">7 Days (1 Week)</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-300 font-medium block mb-1">Data Model Invariants</label>
                <div className="p-2.5 bg-neutral-900/60 rounded border border-neutral-800 text-neutral-400 text-2xs">
                  Contact Status, Registration Status, and Feedback Status are strictly independent.
                </div>
              </div>
            </div>
          </div>

          {/* System & Architecture Info */}
          <div className="panel p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
              <Server className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-200">
                System Diagnostics & Infrastructure
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-neutral-900">
                <span className="text-neutral-400">Backend API</span>
                <span className="text-neutral-200 font-mono">FastAPI Python 3.11</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-neutral-900">
                <span className="text-neutral-400">Database Engine</span>
                <span className="text-neutral-200 font-mono">PostgreSQL (SQLAlchemy ORM)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-neutral-900">
                <span className="text-neutral-400">Auth Standard</span>
                <span className="text-neutral-200 font-mono">JWT Bearer (HS256)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-neutral-400">File Processing</span>
                <span className="text-neutral-200 font-mono">pandas + openpyxl</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
