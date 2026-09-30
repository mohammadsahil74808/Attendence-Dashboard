import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Activity, Eye, EyeOff, Loader2, ShieldCheck, Users, Info, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
})
type LoginForm = z.infer<typeof loginSchema>

type RoleTab = 'admin' | 'member'

export default function LoginPage() {
  const { user, login, isLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [showPwd, setShowPwd] = useState(false)
  const [roleTab, setRoleTab] = useState<RoleTab>('admin')

  const adminEmail = import.meta.env.VITE_DEFAULT_EMAIL || import.meta.env.VITE_USER_EMAIL || 'sahilansari74808@gmail.com'
  const adminPassword = import.meta.env.VITE_DEFAULT_PASSWORD || import.meta.env.VITE_USER_PASSWORD || ''

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: adminEmail,
      password: adminPassword,
    },
  })

  // When switching tabs, provide appropriate defaults
  useEffect(() => {
    if (roleTab === 'admin') {
      setValue('email', adminEmail)
      setValue('password', adminPassword)
    } else {
      setValue('email', 'member@fms.internal')
      setValue('password', 'MemberPassword123!')
    }
  }, [roleTab, setValue, adminEmail, adminPassword])

  if (user) return <Navigate to="/dashboard" replace />

  async function onSubmit(data: LoginForm) {
    try {
      await login(data.email, data.password, roleTab)
      toast(
        roleTab === 'admin'
          ? 'Welcome Administrator! Full workspace access granted.'
          : 'Welcome Team Member! Lead outreach portal loaded.',
        'success'
      )
      navigate('/dashboard')
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Login failed. Check your credentials.', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      {/* Background grid texture */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(to right, #3b82f6 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md">
        {/* App Logo & Header */}
        <div className="flex flex-col items-center justify-center text-center gap-2.5 mb-6">
          <div className="w-11 h-11 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/30">
            <Activity size={22} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-bold text-text-primary tracking-tight">Follow-Up Manager</p>
            <p className="text-xs text-text-muted">Admissions & Outreach Management System</p>
          </div>
        </div>

        {/* Card */}
        <div className="panel p-6 shadow-xl border border-border-subtle">
          {/* Role Selection Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-2 rounded-xl border border-border-subtle mb-6">
            <button
              type="button"
              onClick={() => setRoleTab('admin')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 ${
                roleTab === 'admin'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-3'
              }`}
            >
              <ShieldCheck size={16} />
              <span>Admin Login</span>
            </button>

            <button
              type="button"
              onClick={() => setRoleTab('member')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 ${
                roleTab === 'member'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-3'
              }`}
            >
              <Users size={16} />
              <span>Member Login</span>
            </button>
          </div>

          {/* Role Context Banner */}
          {roleTab === 'admin' ? (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs mb-5">
              <ShieldCheck size={16} className="text-brand-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-text-primary">Administrator Portal: </span>
                Add & remove team members, assign leads to any member, manage colleges & system settings.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs mb-5">
              <Users size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-text-primary">Team Member Portal: </span>
                Add contacts, link colleges, log call attempts, record feedback & register contacts.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="email" className="label text-xs">
                  {roleTab === 'admin' ? 'Admin Email' : 'Member Email'}
                </label>
                {roleTab === 'admin' ? (
                  <span className="text-[11px] text-brand-400 font-medium">Sahil Ansari (Admin)</span>
                ) : (
                  <span className="text-[11px] text-emerald-400 font-medium">Team Member</span>
                )}
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder={roleTab === 'admin' ? 'admin@example.com' : 'member@example.com'}
                {...register('email')}
              />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="label text-xs">Password</label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>

            {/* Quick Demo Pre-fills */}
            <div className="flex items-center justify-between pt-1">
              {roleTab === 'admin' ? (
                <button
                  type="button"
                  onClick={() => {
                    setValue('email', adminEmail)
                    setValue('password', adminPassword)
                  }}
                  className="text-[11px] text-text-muted hover:text-brand-400 transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 size={12} />
                  Reset to Sahil Admin
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setValue('email', 'member@fms.internal')
                    setValue('password', 'MemberPassword123!')
                  }}
                  className="text-[11px] text-text-muted hover:text-emerald-400 transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 size={12} />
                  Fill Demo Member Account
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full justify-center h-10 font-medium text-sm rounded-lg flex items-center gap-2 transition-all ${
                roleTab === 'admin'
                  ? 'btn-primary'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30'
              }`}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : roleTab === 'admin' ? (
                <ShieldCheck size={16} />
              ) : (
                <Users size={16} />
              )}
              {isLoading
                ? 'Verifying...'
                : roleTab === 'admin'
                ? 'Sign in as Administrator'
                : 'Sign in as Team Member'}
            </button>
          </form>
        </div>

        {/* Footer info explaining Supabase sync & member creation */}
        <div className="mt-4 p-3 rounded-lg bg-surface-1 border border-border-subtle flex items-start gap-2 text-[11px] text-text-muted">
          <Info size={14} className="shrink-0 text-text-muted mt-0.5" />
          <div>
            <span>
              <strong>Note:</strong> Jab aap Supabase Authentication mein naya email add karenge, toh wo user <strong>Member Login</strong> tab se seedhe sign in kar sakega aur use automatically <strong>Team Member</strong> role mil jayega.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
